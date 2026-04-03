import { recordAdminError, redactSensitiveData } from '../services/adminErrorLogger.js';

const ALLOWED_SEVERITIES = new Set(['warn', 'error', 'fatal']);

const toStringOrEmpty = (value) => (typeof value === 'string' ? value.trim() : '');

export const captureClientErrorLog = async (req, res) => {
  try {
    const message = toStringOrEmpty(req.body?.message);
    const source = toStringOrEmpty(req.body?.source) || 'frontend.runtime';
    const route = toStringOrEmpty(req.body?.route);
    const action = toStringOrEmpty(req.body?.action);
    const stack = toStringOrEmpty(req.body?.stack);
    const severity = ALLOWED_SEVERITIES.has(req.body?.severity) ? req.body.severity : 'error';

    if (!message) {
      return res.status(400).json({ message: 'Client error message is required.' });
    }

    await recordAdminError({
      error: stack ? { message, stack } : null,
      message,
      severity,
      source,
      route,
      action,
      req,
      metadata: {
        client: redactSensitiveData(req.body?.client || null),
        metadata: redactSensitiveData(req.body?.metadata || null),
      },
    });

    return res.status(201).json({ message: 'Client error log recorded.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to capture client error log.' });
  }
};
