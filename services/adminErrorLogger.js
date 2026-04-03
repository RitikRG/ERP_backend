import mongoose from 'mongoose';
import AdminErrorLog from '../models/adminErrorLog.js';

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|cookie|authorization|api[-_]?key|signature|hashedrefreshtoken)/i;

const toPlainObject = (value) => {
  if (!value) return value;
  if (typeof value?.toObject === 'function') {
    return value.toObject({ depopulate: true });
  }
  return value;
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
  const resolvedMessage = message || error?.message || 'Unknown error';
  const stack = error?.stack || '';

  try {
    const doc = await AdminErrorLog.create({
      severity,
      source,
      message: resolvedMessage,
      stack,
      action,
      route: route || req?.originalUrl || '',
      orgId,
      actorUserId,
      actorAdminId,
      chatSessionId,
      traceConversationId,
      traceTurnId,
      request: buildRequestSnapshot(req),
      metadata: redactSensitiveData(metadata),
    });

    return doc;
  } catch (loggingError) {
    process.stderr.write(
      `[AdminErrorLogger] Failed to persist log: ${loggingError.message}\n`
    );
    return null;
  }
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
