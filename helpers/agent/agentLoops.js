import { buildBasePrompt } from "./basePrompt.js";
import { toolDefinitions } from "./toolsDefinition.js";
import { toolRegistry } from "./toolsRegistry.js";
import { createChatResponse } from "./aiFunctions.js";
import {
  buildResolvedChoiceCorrection,
  clearPendingChoice,
  ensureCheckoutState,
  isChoiceAlreadyResolved,
  parseStructuredAgentReply,
  recordPendingChoice,
  syncExplicitChoiceMentions,
} from "./interactiveFlow.js";

const MAX_ITERATIONS = 6;
const MAX_FINAL_REPLY_REPAIRS = 2;

const normalizeHistoryMessage = (msg) => {
  if (msg.role === "user") {
    return { role: "user", content: msg.content };
  }

  if (msg.role === "assistant") {
    const clean = { role: "assistant", content: msg.content ?? null };
    if (msg.tool_calls?.length > 0) {
      clean.tool_calls = msg.tool_calls;
    }
    return clean;
  }

  if (msg.role === "tool") {
    return {
      role: "tool",
      tool_call_id: msg.tool_call_id,
      content: msg.content,
    };
  }

  return msg;
};

const buildReplyRepairInstruction = (errors = []) =>
  [
    "Your previous reply did not follow the required JSON response format.",
    ...errors,
    'Respond again with valid JSON only using either {"type":"text","message":"..."} or the valid buttons format.',
  ].join(" ");

const tryReturnStructuredReply = ({
  rawContent,
  session,
  finalReplyRepairs,
  onRepairNeeded,
}) => {
  const parsedReply = parseStructuredAgentReply(rawContent);

  if (!parsedReply.ok) {
    if (finalReplyRepairs >= MAX_FINAL_REPLY_REPAIRS) {
      const fallbackReply = {
        type: "text",
        message:
          parsedReply.fallbackMessage ||
          "Sorry, I am having trouble processing your request right now. Please try again.",
      };

      session.history.push({
        role: "assistant",
        content: JSON.stringify(fallbackReply),
      });
      clearPendingChoice(session);
      return { done: true, reply: fallbackReply };
    }

    onRepairNeeded(buildReplyRepairInstruction(parsedReply.errors));
    return { done: false, repaired: true };
  }

  if (
    parsedReply.reply.type === "buttons" &&
    isChoiceAlreadyResolved(session, parsedReply.reply.choiceKey)
  ) {
    if (finalReplyRepairs >= MAX_FINAL_REPLY_REPAIRS) {
      const fallbackReply = {
        type: "text",
        message:
          "I already have that choice noted. Please continue with the next step.",
      };

      session.history.push({
        role: "assistant",
        content: JSON.stringify(fallbackReply),
      });
      clearPendingChoice(session);
      return { done: true, reply: fallbackReply };
    }

    onRepairNeeded(
      buildResolvedChoiceCorrection(session, parsedReply.reply.choiceKey)
    );
    return { done: false, repaired: true };
  }

  session.history.push({
    role: "assistant",
    content: rawContent,
  });

  recordPendingChoice(session, parsedReply.reply);
  return { done: true, reply: parsedReply.reply };
};

export const runAgentLoop = async (
  session,
  transcript,
  sop,
  paymentContext = {},
  traceRecorder = null
) => {
  ensureCheckoutState(session);
  syncExplicitChoiceMentions(session, transcript);

  session.history.push({
    role: "user",
    content: transcript,
  });

  let iterations = 0;
  let finalReplyRepairs = 0;
  let repairInstruction = "";
  let lastTraceMeta = {
    provider: "",
    model: "",
    usage: null,
    finishReason: "",
    latencyMs: null,
  };

  const buildMessages = () => {
    const messages = [
      {
        role: "system",
        content: buildBasePrompt(sop, session.cart, paymentContext, session),
      },
    ];

    if (repairInstruction) {
      messages.push({
        role: "system",
        content: repairInstruction,
      });
    }

    return [...messages, ...session.history.map(normalizeHistoryMessage)];
  };

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const messages = buildMessages();
    await traceRecorder?.recordRequestMessages(messages);

    const startedAt = Date.now();
    const response = await createChatResponse({
      messages,
      tools: toolDefinitions,
      toolChoice: "auto",
    });
    const { message, finishReason } = response;
    const iterationDetails = {
      iteration: iterations,
      requestMessages: messages,
      repairInstruction: repairInstruction || "",
      assistantMessage: message,
      finishReason,
      provider: response.provider || "",
      model: response.model || "",
      usage: response.usage || null,
      latencyMs: Date.now() - startedAt,
      toolExecutions: [],
    };
    lastTraceMeta = {
      provider: response.provider || "",
      model: response.model || "",
      usage: response.usage || null,
      finishReason: finishReason || "",
      latencyMs: iterationDetails.latencyMs,
    };

    if (finishReason === "tool_calls" && message.tool_calls?.length > 0) {
      repairInstruction = "";

      session.history.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });

      if (
        message.tool_calls.length === 1 &&
        message.tool_calls[0]?.function?.name === "json"
      ) {
        const jsonToolCall = message.tool_calls[0];
        const structuredReplyResult = tryReturnStructuredReply({
          rawContent: jsonToolCall.function.arguments,
          session,
          finalReplyRepairs,
          onRepairNeeded: (instruction) => {
            repairInstruction = instruction;
            finalReplyRepairs++;
          },
        });
        await traceRecorder?.recordIteration(iterationDetails);

        if (structuredReplyResult.done) {
          return {
            ...structuredReplyResult.reply,
            _traceMeta: lastTraceMeta,
          };
        }

        await traceRecorder?.addRepairInstruction(repairInstruction);

        continue;
      }

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        let toolResult;

        try {
          const fn = toolRegistry[toolName];

          if (!fn) {
            toolResult = { error: `Tool ${toolName} not found.` };
          } else {
            toolResult = await fn(toolArgs, session);
          }
        } catch (err) {
          toolResult = { error: `Tool ${toolName} failed: ${err.message}` };
        }

        session.history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });

        iterationDetails.toolExecutions.push({
          toolCallId: toolCall.id,
          toolName,
          toolArgs,
          toolResult,
        });
      }

      await traceRecorder?.recordIteration(iterationDetails);

      continue;
    }

    if (finishReason === "stop" && message.content) {
      const structuredReplyResult = tryReturnStructuredReply({
        rawContent: message.content,
        session,
        finalReplyRepairs,
        onRepairNeeded: (instruction) => {
          repairInstruction = instruction;
          finalReplyRepairs++;
        },
      });
      await traceRecorder?.recordIteration(iterationDetails);

      if (structuredReplyResult.done) {
        repairInstruction = "";
        return {
          ...structuredReplyResult.reply,
          _traceMeta: lastTraceMeta,
        };
      }

      await traceRecorder?.addRepairInstruction(repairInstruction);

      continue;
    }

    await traceRecorder?.recordIteration(iterationDetails);

    break;
  }

  clearPendingChoice(session);
  return {
    type: "text",
    message:
      "Sorry, I am having trouble processing your request right now. Please try again.",
    _traceMeta: lastTraceMeta,
  };
};
