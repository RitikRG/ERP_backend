import NotificationTemplate from '../models/notificationTemplate.js';

const DEFAULT_TEMPLATES = {
  online_order_created: {
    titleTemplate: 'New Online Order',
    bodyTemplate: 'Order #{{orderShortId}} placed for Rs{{total}}',
    allowedVariables: ['orderShortId', 'total', 'organisationName', 'customerNumber'],
    samplePayload: {
      orderShortId: '123456',
      total: '450',
      organisationName: 'RNR Mart',
      customerNumber: 'whatsapp:+911234567890',
    },
  },
  delivery_assigned: {
    titleTemplate: 'New Delivery Assigned',
    bodyTemplate: 'You have been assigned to deliver Order #{{orderShortId}}.',
    allowedVariables: ['orderShortId', 'agentName', 'organisationName'],
    samplePayload: {
      orderShortId: '123456',
      agentName: 'Delivery Agent',
      organisationName: 'RNR Mart',
    },
  },
  delivery_otp_sent: {
    titleTemplate: 'Delivery OTP Sent',
    bodyTemplate: 'OTP generated for Order #{{orderShortId}}',
    allowedVariables: ['orderShortId', 'organisationName'],
    samplePayload: {
      orderShortId: '123456',
      organisationName: 'RNR Mart',
    },
  },
  delivery_completed: {
    titleTemplate: 'Delivery Completed',
    bodyTemplate: 'Order #{{orderShortId}} was successfully delivered.',
    allowedVariables: ['orderShortId', 'status', 'organisationName'],
    samplePayload: {
      orderShortId: '123456',
      status: 'fulfilled',
      organisationName: 'RNR Mart',
    },
  },
  delivery_cancelled: {
    titleTemplate: 'Order Cancelled',
    bodyTemplate: 'Order #{{orderShortId}} status updated to {{status}}.',
    allowedVariables: ['orderShortId', 'status', 'organisationName'],
    samplePayload: {
      orderShortId: '123456',
      status: 'cancelled',
      organisationName: 'RNR Mart',
    },
  },
};

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const extractPlaceholders = (template) => {
  const names = new Set();
  String(template || '').replace(PLACEHOLDER_PATTERN, (_, name) => {
    names.add(name);
    return _;
  });
  return Array.from(names);
};

const validateTemplateFields = ({ type, titleTemplate, bodyTemplate }) => {
  const defaultTemplate = DEFAULT_TEMPLATES[type];
  if (!defaultTemplate) {
    throw new Error(`Unsupported notification template type: ${type}`);
  }

  const placeholders = [
    ...extractPlaceholders(titleTemplate),
    ...extractPlaceholders(bodyTemplate),
  ];
  const invalidVariables = placeholders.filter(
    (name) => !defaultTemplate.allowedVariables.includes(name)
  );

  if (invalidVariables.length > 0) {
    throw new Error(`Unknown variables: ${invalidVariables.join(', ')}`);
  }
};

const renderTemplate = (template, payload = {}) =>
  String(template || '').replace(PLACEHOLDER_PATTERN, (_, name) => {
    const value = payload[name];
    return value === undefined || value === null ? '' : String(value);
  });

const normalizeTemplatePayload = (type, payload = {}) => {
  const defaultTemplate = DEFAULT_TEMPLATES[type];
  return {
    ...defaultTemplate.samplePayload,
    ...payload,
  };
};

export const ensureNotificationTemplatesSeeded = async () => {
  const operations = Object.entries(DEFAULT_TEMPLATES).map(([type, template]) =>
    NotificationTemplate.findOneAndUpdate(
      { type },
      {
        $setOnInsert: {
          type,
          titleTemplate: template.titleTemplate,
          bodyTemplate: template.bodyTemplate,
          defaultTitleTemplate: template.titleTemplate,
          defaultBodyTemplate: template.bodyTemplate,
          allowedVariables: template.allowedVariables,
          samplePayload: template.samplePayload,
          isActive: true,
        },
      },
      {
        upsert: true,
        new: true,
      }
    )
  );

  await Promise.all(operations);
};

export const listNotificationTemplates = async () =>
  NotificationTemplate.find().sort({ type: 1 }).lean();

export const getNotificationTemplate = async (type) => {
  const template = await NotificationTemplate.findOne({ type }).lean();
  if (!template) {
    throw new Error(`Notification template ${type} not found`);
  }
  return template;
};

export const previewNotificationTemplate = async (type, payload = {}) => {
  const template = await getNotificationTemplate(type);
  const mergedPayload = normalizeTemplatePayload(type, payload);

  return {
    type,
    payload: mergedPayload,
    title: renderTemplate(template.titleTemplate, mergedPayload),
    body: renderTemplate(template.bodyTemplate, mergedPayload),
  };
};

export const updateNotificationTemplate = async ({
  type,
  titleTemplate,
  bodyTemplate,
  adminUserId = null,
}) => {
  validateTemplateFields({ type, titleTemplate, bodyTemplate });

  const template = await NotificationTemplate.findOneAndUpdate(
    { type },
    {
      $set: {
        titleTemplate,
        bodyTemplate,
        lastUpdatedByAdmin: adminUserId,
      },
    },
    { new: true }
  ).lean();

  if (!template) {
    throw new Error(`Notification template ${type} not found`);
  }

  return template;
};

export const resetNotificationTemplate = async (type, adminUserId = null) => {
  const template = await NotificationTemplate.findOneAndUpdate(
    { type },
    {
      $set: {
        titleTemplate: DEFAULT_TEMPLATES[type].titleTemplate,
        bodyTemplate: DEFAULT_TEMPLATES[type].bodyTemplate,
        lastUpdatedByAdmin: adminUserId,
      },
    },
    { new: true }
  ).lean();

  if (!template) {
    throw new Error(`Notification template ${type} not found`);
  }

  return template;
};

export const renderNotificationTemplate = async ({ type, payload = {} }) => {
  const template = await getNotificationTemplate(type);
  const mergedPayload = normalizeTemplatePayload(type, payload);

  return {
    title: renderTemplate(template.titleTemplate, mergedPayload),
    body: renderTemplate(template.bodyTemplate, mergedPayload),
    payload: mergedPayload,
    template,
  };
};

export const getNotificationTemplateDefaults = () => DEFAULT_TEMPLATES;
