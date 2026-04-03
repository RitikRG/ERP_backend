import Organisation from '../models/organisation.js';
import AdminErrorLog from '../models/adminErrorLog.js';
import AiConversationTrace from '../models/aiConversationTrace.js';
import AiTraceTurn from '../models/aiTraceTurn.js';
import {
  getNotificationTemplate,
  listNotificationTemplates,
  previewNotificationTemplate,
  resetNotificationTemplate,
  updateNotificationTemplate,
} from '../services/notificationTemplateService.js';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildDateRangeFilter = (startDate, endDate) => {
  const filter = {};
  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!Number.isNaN(parsedStart.getTime())) {
      filter.$gte = parsedStart;
    }
  }
  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!Number.isNaN(parsedEnd.getTime())) {
      filter.$lte = parsedEnd;
    }
  }
  return Object.keys(filter).length ? filter : null;
};

export const listAdminOrganisations = async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { gst: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const organisations = await Organisation.find(filter)
      .select('_id name gst phone createdAt updatedAt')
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ organisations });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch organisations.' });
  }
};

export const listAdminErrorLogs = async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const { orgId, source, severity, search, startDate, endDate } = req.query;

    const filter = {};
    if (orgId) filter.orgId = orgId;
    if (source) filter.source = String(source);
    if (severity) filter.severity = String(severity);

    const createdAtFilter = buildDateRangeFilter(startDate, endDate);
    if (createdAtFilter) filter.createdAt = createdAtFilter;

    if (search) {
      filter.$or = [
        { message: { $regex: String(search), $options: 'i' } },
        { stack: { $regex: String(search), $options: 'i' } },
        { action: { $regex: String(search), $options: 'i' } },
        { route: { $regex: String(search), $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      AdminErrorLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('orgId', 'name')
        .lean(),
      AdminErrorLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      page,
      limit,
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch error logs.' });
  }
};

export const getAdminErrorLog = async (req, res) => {
  try {
    const item = await AdminErrorLog.findById(req.params.id)
      .populate('orgId', 'name')
      .populate('actorUserId', 'name email type')
      .populate('actorAdminId', 'name email')
      .lean();

    if (!item) {
      return res.status(404).json({ message: 'Error log not found.' });
    }

    return res.status(200).json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch error log.' });
  }
};

export const listAdminAiTraces = async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const { orgId, customerNumber, chatSessionId, status, startDate, endDate } = req.query;

    const filter = {};
    if (orgId) filter.organisationId = orgId;
    if (customerNumber) {
      filter.customerNumber = { $regex: String(customerNumber), $options: 'i' };
    }
    if (chatSessionId) filter.chatSessionId = String(chatSessionId);
    if (status) filter.status = String(status);

    const startedAtFilter = buildDateRangeFilter(startDate, endDate);
    if (startedAtFilter) filter.startedAt = startedAtFilter;

    const [items, total] = await Promise.all([
      AiConversationTrace.find(filter)
        .sort({ lastTurnAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organisationId', 'name')
        .lean(),
      AiConversationTrace.countDocuments(filter),
    ]);

    return res.status(200).json({ items, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch AI traces.' });
  }
};

export const getAdminAiTrace = async (req, res) => {
  try {
    const trace = await AiConversationTrace.findById(req.params.id)
      .populate('organisationId', 'name')
      .lean();

    if (!trace) {
      return res.status(404).json({ message: 'AI trace not found.' });
    }

    const turns = await AiTraceTurn.find({ conversationTraceId: trace._id })
      .sort({ sequenceNumber: 1 })
      .populate('errorLogId', 'message source severity createdAt')
      .lean();

    return res.status(200).json({ trace, turns });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch AI trace.' });
  }
};

export const listAdminNotificationTemplates = async (_req, res) => {
  try {
    const items = await listNotificationTemplates();
    return res.status(200).json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch notification templates.' });
  }
};

export const getAdminNotificationTemplate = async (req, res) => {
  try {
    const item = await getNotificationTemplate(req.params.type);
    return res.status(200).json({ item });
  } catch (error) {
    return res.status(404).json({ message: error.message || 'Notification template not found.' });
  }
};

export const updateAdminNotificationTemplate = async (req, res) => {
  try {
    const item = await updateNotificationTemplate({
      type: req.params.type,
      titleTemplate: req.body.titleTemplate,
      bodyTemplate: req.body.bodyTemplate,
      adminUserId: req.admin?._id || null,
    });

    return res.status(200).json({ item, message: 'Notification template updated successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to update notification template.' });
  }
};

export const previewAdminNotificationTemplate = async (req, res) => {
  try {
    const preview = await previewNotificationTemplate(req.params.type, req.body.payload || {});
    return res.status(200).json({ preview });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to preview notification template.' });
  }
};

export const resetAdminNotificationTemplate = async (req, res) => {
  try {
    const item = await resetNotificationTemplate(req.params.type, req.admin?._id || null);
    return res.status(200).json({ item, message: 'Notification template reset successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to reset notification template.' });
  }
};
