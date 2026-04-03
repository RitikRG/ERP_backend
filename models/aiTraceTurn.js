import mongoose from 'mongoose';

const aiTraceTurnSchema = new mongoose.Schema(
  {
    conversationTraceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AiConversationTrace',
      required: true,
    },
    organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    chatSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSessions', required: true },
    customerNumber: { type: String, required: true, trim: true },
    sequenceNumber: { type: Number, required: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
      index: true,
    },
    rawInboundPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    normalizedInboundPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    resolvedTranscript: { type: String, default: '' },
    sessionSnapshotBefore: { type: mongoose.Schema.Types.Mixed, default: null },
    sessionSnapshotAfter: { type: mongoose.Schema.Types.Mixed, default: null },
    requestMessages: { type: [mongoose.Schema.Types.Mixed], default: [] },
    iterations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    repairInstructions: { type: [String], default: [] },
    provider: { type: String, default: '' },
    model: { type: String, default: '' },
    finishReason: { type: String, default: '' },
    usage: { type: mongoose.Schema.Types.Mixed, default: null },
    latencyMs: { type: Number, default: null },
    outboundReply: { type: mongoose.Schema.Types.Mixed, default: null },
    outboundTransport: { type: mongoose.Schema.Types.Mixed, default: null },
    errorLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminErrorLog', default: null },
  },
  {
    timestamps: true,
    collection: 'AiTraceTurns',
  }
);

aiTraceTurnSchema.index({ organisationId: 1, startedAt: -1 });
aiTraceTurnSchema.index({ chatSessionId: 1 });
aiTraceTurnSchema.index({ customerNumber: 1 });
aiTraceTurnSchema.index({ conversationTraceId: 1, sequenceNumber: 1 }, { unique: true });

const AiTraceTurn = mongoose.model('AiTraceTurn', aiTraceTurnSchema);
export default AiTraceTurn;
