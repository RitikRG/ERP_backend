import mongoose from 'mongoose';

const adminErrorLogSchema = new mongoose.Schema(
  {
    severity: {
      type: String,
      enum: ['error', 'warn', 'fatal'],
      default: 'error',
      index: true,
    },
    source: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    stack: { type: String, default: '' },
    route: { type: String, default: '' },
    action: { type: String, default: '' },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    chatSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSessions', default: null },
    traceConversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AiConversationTrace',
      default: null,
    },
    traceTurnId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiTraceTurn', default: null },
    request: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'AdminErrorLogs',
  }
);

adminErrorLogSchema.index({ orgId: 1, createdAt: -1 });
adminErrorLogSchema.index({ source: 1, createdAt: -1 });

const AdminErrorLog = mongoose.model('AdminErrorLog', adminErrorLogSchema);
export default AdminErrorLog;
