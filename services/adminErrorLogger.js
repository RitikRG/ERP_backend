import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';
import AdminErrorLog from '../models/adminErrorLog.js';

const requestContextStore = new AsyncLocalStorage();

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|cookie|authorization|api[-_]?key|signature|hashedrefreshtoken)/i;

const toPlainObject = (value) => {
  if (!value) return value;
  if (typeof value?.toObject === 'function') {
    return value.toObject({ depopulate: true });
  }
  return value;
};

const getRequestContext = () => requestContextStore.getStore()?.req || null;

const getRouteSignature = (req) => {
  if (!req) return '';

  const routePath = req.route?.path;
  if (routePath) {
    return `${req.baseUrl || ''}${routePath}`;
  }

  return req.originalUrl || '';
};

const markRequestAsLogged = (req) => {
  if (!req) return;
  req.__adminErrorLogCount = (req.__adminErrorLogCount || 0) + 1;
};

const hasRequestLog = (req) => Boolean(req?.__adminErrorLogCount);

const normalizeResponseBody = (body) => {
  if (body === undefined) return undefined;
  if (Buffer.isBuffer(body)) {
    return `[Buffer ${body.length} bytes]`;
  }
  return redactSensitiveData(body);
};

export const redactSensitiveData = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || '',
    };
  }

  if (typeof value?.toHexString === 'function') {
    return value.toHexString();
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }

  const objectValue = toPlainObject(value);
  const result = {};

  Object.entries(objectValue || {}).forEach(([key, entryValue]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
      return;
    }

    result[key] = redactSensitiveData(entryValue, seen);
  });

  return result;
};

const buildRequestSnapshot = (req) => {
  if (!req) return null;

  return redactSensitiveData({
    requestId: req.id || '',
    method: req.method,
    originalUrl: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body,
    ip: req.ip,
    userAgent: req.headers?.['user-agent'] || '',
    headers: {
      authorization: req.headers?.authorization,
      cookie: req.headers?.cookie,
      referer: req.headers?.referer,
      origin: req.headers?.origin,
    },
  });
};

export const recordAdminError = async ({
  error,
  message,
  severity = 'error',
  source = 'backend',
  action = '',
  route = '',
  req = null,
  orgId = null,
  actorUserId = null,
  actorAdminId = null,
  chatSessionId = null,
  traceConversationId = null,
  traceTurnId = null,
  metadata = null,
} = {}) => {
  const activeReq = req || getRequestContext();
  const resolvedRoute = route || getRouteSignature(activeReq);
  const resolvedMessage = message || error?.message || 'Unknown error';
  const stack = error?.stack || '';

  try {
    const doc = await AdminErrorLog.create({
      severity,
      source,
      message: resolvedMessage,
      stack,
      action,
      route: resolvedRoute,
      orgId: orgId ?? activeReq?.user?.org_id ?? null,
      actorUserId: actorUserId ?? activeReq?.user?._id ?? null,
      actorAdminId: actorAdminId ?? activeReq?.admin?._id ?? null,
      chatSessionId,
      traceConversationId,
      traceTurnId,
      request: buildRequestSnapshot(activeReq),
      metadata: redactSensitiveData(metadata),
    });

    markRequestAsLogged(activeReq);
    return doc;
  } catch (loggingError) {
    process.stderr.write(
      `[AdminErrorLogger] Failed to persist log: ${loggingError.message}\n`
    );
    return null;
  }
};

export const bindAdminErrorRequestContext = (req, _res, next) => {
  req.__adminErrorLogCount = 0;
  req.id = req.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  requestContextStore.run({ req }, () => next());
};

export const captureResponseErrors = (req, res, next) => {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  const storeResponseBody = (body) => {
    if (res.locals.__adminErrorResponseBody === undefined) {
      res.locals.__adminErrorResponseBody = normalizeResponseBody(body);
    }
    return body;
  };

  res.json = (body) => originalJson(storeResponseBody(body));
  res.send = (body) => originalSend(storeResponseBody(body));

  res.on('finish', () => {
    if (res.statusCode < 500 || mongoose.connection.readyState !== 1 || hasRequestLog(req)) {
      return;
    }

    const responseBody = res.locals.__adminErrorResponseBody;
    const responseMessage =
      (typeof responseBody === 'object' && responseBody && 'message' in responseBody
        ? responseBody.message
        : null) ||
      `HTTP ${res.statusCode} for ${req.method} ${req.originalUrl}`;

    recordAdminError({
      message: responseMessage,
      source: 'http.response',
      action: req.method,
      route: req.originalUrl,
      req,
      metadata: {
        statusCode: res.statusCode,
        responseBody,
      },
    }).catch(() => {});
  });

  next();
};

export const handleExpressErrors = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  recordAdminError({
    error,
    severity: 'error',
    source: 'express.error',
    action: req.method,
    route: req.originalUrl,
    req,
    metadata: { statusCode: 500 },
  }).catch(() => {});

  res.status(500).json({ message: error?.message || 'Internal server error.' });
};

export const installAdminErrorCapture = () => {
  if (global.__adminErrorCaptureInstalled) {
    return;
  }

  global.__adminErrorCaptureInstalled = true;

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    originalConsoleError(...args);

    if (mongoose.connection.readyState !== 1) {
      return;
    }

    const [firstArg, ...rest] = args;
    const messageParts = [firstArg, ...rest]
      .map((part) => {
        if (part instanceof Error) return part.message;
        if (typeof part === 'string') return part;
        try {
          return JSON.stringify(redactSensitiveData(part));
        } catch {
          return String(part);
        }
      })
      .filter(Boolean);

    const errorArg = args.find((arg) => arg instanceof Error);

    recordAdminError({
      error: errorArg,
      message: messageParts.join(' '),
      source: 'console.error',
      metadata: { args: redactSensitiveData(args) },
    }).catch(() => {});
  };

  const originalConsoleWarn = console.warn.bind(console);
  console.warn = (...args) => {
    originalConsoleWarn(...args);

    if (mongoose.connection.readyState !== 1) {
      return;
    }

    const messageParts = args
      .map((part) => {
        if (part instanceof Error) return part.message;
        if (typeof part === 'string') return part;
        try {
          return JSON.stringify(redactSensitiveData(part));
        } catch {
          return String(part);
        }
      })
      .filter(Boolean);

    const errorArg = args.find((arg) => arg instanceof Error);

    recordAdminError({
      error: errorArg,
      message: messageParts.join(' '),
      severity: 'warn',
      source: 'console.warn',
      metadata: { args: redactSensitiveData(args) },
    }).catch(() => {});
  };

  process.on('uncaughtException', (error) => {
    recordAdminError({
      error,
      severity: 'fatal',
      source: 'process.uncaughtException',
    }).catch(() => {});
  });

  process.on('unhandledRejection', (reason) => {
    const error =
      reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Unhandled promise rejection');

    recordAdminError({
      error,
      severity: 'fatal',
      source: 'process.unhandledRejection',
      metadata: { reason: redactSensitiveData(reason) },
    }).catch(() => {});
  });
};
