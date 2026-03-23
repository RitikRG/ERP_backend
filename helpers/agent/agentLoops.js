import { inspect } from "node:util";
import { buildBasePrompt } from "./basePrompt.js";
import { toolDefinitions } from "./toolsDefinition.js";
import { toolRegistry } from "./toolsRegistry.js";
import { createChatResponse } from "./aiFunctions.js";

const MAX_ITERATIONS = 5; // prevent infinite loops

const formatDebugValue = (value) =>
  typeof value === "string"
    ? value
    : inspect(value, {
        depth: null,
        colors: false,
        compact: false,
        breakLength: 120,
        maxArrayLength: null,
        maxStringLength: null,
      });

const logStep = (label, value) => {
  if (value === undefined) {
    console.log(`[L3] ${label}`);
    return;
  }

  console.log(`[L3] ${label}:\n${formatDebugValue(value)}`);
};

/***
 * runAgentLoop
 * Core of Layer 3 — takes a session and transcript, runs the tool calling loop,
 * returns the final reply text to send to the customer
 *
 * @param {object} session - { customerNumber, organisationId, cart, history }
 * @param {string} transcript - plain text from Layer 2
 * @param {object} sop - merged shop SOP from getSopForShop()
 * @returns {string} - final reply text for Layer 5
 */
export const runAgentLoop = async (session, transcript, sop) => {
  // append customer message to history
  session.history.push({
    role: "user",
    content: transcript,
  });

  // build messages array — system prompt + full history
  // system prompt is rebuilt every turn so cart state is always fresh
  const buildMessages = () => [
    {
      role: "system",
      content: buildBasePrompt(sop, session.cart),
    },
    ...session.history.map((msg) => {
      // strip out any keys the provider wrapper does not pass through
      if (msg.role === "user") {
        return { role: "user", content: msg.content };
      }

      if (msg.role === "assistant") {
        const clean = { role: "assistant", content: msg.content ?? null };
        // only include tool_calls if it actually exists and has items
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
    }),
  ];

  let iterations = 0;

  // the loop
  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // call the LLM
    const messages = buildMessages();
    const completionPayload = {
      model: "openai/gpt-oss-20b",
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
    };

    const { message, finishReason } = await createChatResponse({
      model: completionPayload.model,
      messages: completionPayload.messages,
      tools: completionPayload.tools,
      toolChoice: completionPayload.tool_choice,
    });

    // logStep("Parsed LLM message", message);
    // logStep("finish_reason", finishReason);

    // --- CASE 1: LLM wants to call tools ---
    if (finishReason === "tool_calls" && message.tool_calls?.length > 0) {
      // append assistant message to history first — required before tool results
      session.history.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });

      // execute each tool call
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments); // must parse — it's a JSON string

        logStep("Current tool call", toolCall);
        logStep(`Calling tool ${toolName} with args`, toolArgs);
        logStep(`Session before tool ${toolName}`, session);

        let toolResult;

        try {
          const fn = toolRegistry[toolName];
          logStep(`Resolved tool function for ${toolName}`, {
            exists: Boolean(fn),
          });

          if (!fn) {
            toolResult = { error: `Tool ${toolName} not found.` };
          } else {
            toolResult = await fn(toolArgs, session); // session passed so tools can mutate cart
          }
        } catch (err) {
          logStep(`Tool ${toolName} error object`, err);
          toolResult = { error: `Tool ${toolName} failed: ${err.message}` };
        }

        logStep(`Tool ${toolName} result`, toolResult);
        logStep(`Session after tool ${toolName}`, session);

        // append tool result to history — must reference tool_call_id
        session.history.push({
          role: "tool",
          tool_call_id: toolCall.id, // must match — LLM uses this to pair result to call
          content: JSON.stringify(toolResult),
        });
        logStep(
          `History after appending tool result for ${toolName}`,
          session.history
        );
      }

      // loop continues — LLM will now reason over tool results
      logStep("Continuing loop after tool execution", {
        iteration: iterations,
        historyLength: session.history.length,
      });
      continue;
    }

    // --- CASE 2: LLM has a final text reply ---
    if (finishReason === "stop" && message.content) {
      // append assistant reply to history for next turn's context
      session.history.push({
        role: "assistant",
        content: message.content,
      });

      logStep("History after appending final assistant reply", session.history);
      logStep("Final reply", message.content);
      return message.content;
    }

    // --- CASE 3: unexpected finish reason ---
    console.warn(`[L3] Unexpected finish_reason: ${finishReason}`);
    logStep("Unexpected finish reason message payload", message);
    break;
  }

  // loop hit max iterations without a final reply — return fallback
  console.error("[L3] Max iterations reached without final reply");
  logStep("Fallback return session snapshot", session);
  return "Sorry, I'm having trouble processing your request right now. Please try again.";
};
