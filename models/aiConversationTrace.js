import mongoose from 'mongoose';

const aiConversationTraceSchema = new mongoose.Schema(
  {
    organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    chatSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSessions', required: true },
    customerNumber: { type: String, required: true, trim: true },
    startedAt: { type: Date, default: Date.now },
    lastTurnAt: { type: Date, default: Date.now },
    turnCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },
    lastErrorLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminErrorLog', default: null },
  },
  {
    timestamps: true,
    collection: 'AiConversationTraces',
  }
);

aiConversationTraceSchema.index({ organisationId: 1, startedAt: -1 });
aiConversationTraceSchema.index({ chatSessionId: 1 });
aiConversationTraceSchema.index({ customerNumber: 1 });

const AiConversationTrace = mongoose.model('AiConversationTrace', aiConversationTraceSchema);
export default AiConversationTrace;
