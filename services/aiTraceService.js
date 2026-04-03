import AiConversationTrace from '../models/aiConversationTrace.js';
import AiTraceTurn from '../models/aiTraceTurn.js';
import { redactSensitiveData } from './adminErrorLogger.js';

const snapshotSession = (session) => {
  if (!session) return null;
  const plain = typeof session.toObject === 'function'
    ? session.toObject({ depopulate: true })
    : session;

  return redactSensitiveData({
    _id: plain._id,
    mobile_number: plain.mobile_number,
    organisationId: plain.organisationId,
    active: plain.active,
    cart: plain.cart,
    checkoutState: plain.checkoutState,
    history: plain.history,
    lastActivityAt: plain.lastActivityAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    $locals: session.$locals || {},
  });
};

const upsertConversationTrace = async ({ organisationId, chatSessionId, customerNumber }) =>
  AiConversationTrace.findOneAndUpdate(
    { chatSessionId },
    {
      $setOnInsert: {
        organisationId,
        chatSessionId,
        customerNumber,
        startedAt: new Date(),
      },
      $set: {
        organisationId,
        customerNumber,
        lastTurnAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

export const createAiTraceRecorder = async ({
  organisationId,
  chatSessionId,
  customerNumber,
  rawInboundPayload,
  normalizedInboundPayload,
  session,
}) => {
  const conversation = await upsertConversationTrace({
    organisationId,
    chatSessionId,
    customerNumber,
  });

  const updatedConversation = await AiConversationTrace.findByIdAndUpdate(
    conversation._id,
    {
      $inc: { turnCount: 1 },
      $set: { lastTurnAt: new Date(), status: 'running' },
    },
    { new: true }
  );

  const turn = await AiTraceTurn.create({
    conversationTraceId: updatedConversation._id,
    organisationId,
    chatSessionId,
    customerNumber,
    sequenceNumber: updatedConversation.turnCount,
    startedAt: new Date(),
    rawInboundPayload: redactSensitiveData(rawInboundPayload),
    normalizedInboundPayload: redactSensitiveData(normalizedInboundPayload),
    sessionSnapshotBefore: snapshotSession(session),
  });

  const state = {
    turnId: turn._id,
    conversationId: updatedConversation._id,
    iterations: [],
    repairInstructions: [],
  };

  const save = async (patch = {}) => {
    await AiTraceTurn.findByIdAndUpdate(state.turnId, {
      $set: {
        iterations: state.iterations,
        repairInstructions: state.repairInstructions,
        ...patch,
      },
    });
  };

  return {
    conversationId: state.conversationId,
    turnId: state.turnId,
    async recordTranscript(transcript) {
      await save({ resolvedTranscript: transcript || '' });
    },
    async recordRequestMessages(messages) {
      await save({ requestMessages: redactSensitiveData(messages) });
    },
    async recordIteration(iterationPatch) {
      const index = Number(iterationPatch?.iteration || 1) - 1;
      const previous = state.iterations[index] || {};
      state.iterations[index] = redactSensitiveData({
        ...previous,
        ...iterationPatch,
      });
      await save();
    },
    async addRepairInstruction(instruction) {
      if (!instruction) return;
      state.repairInstructions.push(String(instruction));
      await save();
    },
    async complete({ session: finalSession, outboundReply, outboundTransport, finishReason, provider, model, usage, latencyMs }) {
      await save({
        sessionSnapshotAfter: snapshotSession(finalSession),
        outboundReply: redactSensitiveData(outboundReply),
        outboundTransport: redactSensitiveData(outboundTransport),
        finishReason: finishReason || '',
        provider: provider || '',
        model: model || '',
        usage: redactSensitiveData(usage),
        latencyMs: latencyMs ?? null,
        completedAt: new Date(),
        status: 'completed',
      });

      await AiConversationTrace.findByIdAndUpdate(state.conversationId, {
        $set: {
          lastTurnAt: new Date(),
          status: 'completed',
        },
      });
    },
    async fail({ session: finalSession, errorLogId = null }) {
      await save({
        sessionSnapshotAfter: snapshotSession(finalSession),
        errorLogId,
        completedAt: new Date(),
        status: 'failed',
      });

      await AiConversationTrace.findByIdAndUpdate(state.conversationId, {
        $set: {
          lastTurnAt: new Date(),
          status: 'failed',
          lastErrorLogId: errorLogId,
        },
      });
    },
    async linkError(errorLogId) {
      await save({ errorLogId });
      await AiConversationTrace.findByIdAndUpdate(state.conversationId, {
        $set: { lastErrorLogId: errorLogId, status: 'failed' },
      });
    },
  };
};
