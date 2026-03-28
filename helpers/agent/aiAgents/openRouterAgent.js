import { OpenRouter } from "@openrouter/sdk";
import {
  generateGroqSpeechAudio,
  transcribeGroqAudioFile,
} from "./groqAgent.js";

const OPENROUTER_CHAT_MODEL = "z-ai/glm-4.5-air:free";

let openRouterClient;

const getClient = () => {
  if (openRouterClient) {
    return openRouterClient;
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is required when using the OpenRouter provider."
    );
  }

  openRouterClient = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  return openRouterClient;
};

const normalizeOpenRouterMessage = (message) => ({
  ...message,
  tool_calls: message.tool_calls ?? message.toolCalls,
});

const mapMessagesForOpenRouter = (messages = []) =>
  messages.map((message) => {
    if (message.role === "assistant") {
      return {
        ...message,
        toolCalls: message.toolCalls ?? message.tool_calls,
      };
    }

    if (message.role === "tool") {
      return {
        ...message,
        toolCallId: message.toolCallId ?? message.tool_call_id,
      };
    }

    return message;
  });

export const createOpenRouterChatResponse = async ({
  model,
  messages,
  tools,
  toolChoice = "auto",
}) => {
  try {
    const response = await getClient().chat.send({
      chatGenerationParams: {
        model: model || OPENROUTER_CHAT_MODEL,
        messages: mapMessagesForOpenRouter(messages),
        tools,
        toolChoice,
      },
    });

    console.log("OpenRouter raw response:", response);
    const choice = response.choices?.[0];

    if (!choice?.message) {
      throw new Error("AI provider returned an empty chat response.");
    }

    return {
      message: normalizeOpenRouterMessage(choice.message),
      finishReason: choice.finishReason,
      raw: response,
    };
  } catch (err) {
    console.log(err);
  }
};

export const transcribeOpenRouterAudioFile = async (args) =>
  transcribeGroqAudioFile(args);

export const generateOpenRouterSpeechAudio = async (args) =>
  generateGroqSpeechAudio(args);
