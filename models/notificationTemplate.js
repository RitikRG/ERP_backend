import mongoose from 'mongoose';

const notificationTemplateSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: [
        'online_order_created',
        'delivery_assigned',
        'delivery_otp_sent',
        'delivery_completed',
        'delivery_cancelled',
      ],
    },
    titleTemplate: { type: String, required: true },
    bodyTemplate: { type: String, required: true },
    defaultTitleTemplate: { type: String, required: true },
    defaultBodyTemplate: { type: String, required: true },
    allowedVariables: { type: [String], default: [] },
    samplePayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastUpdatedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'NotificationTemplates',
  }
);

notificationTemplateSchema.index({ type: 1, isActive: 1 });

const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);
export default NotificationTemplate;
