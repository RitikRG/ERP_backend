import { OpenRouter } from "@openrouter/sdk";
import Groq from "groq-sdk";

const GROQ_PROVIDER = "groq";
const OPENROUTER_PROVIDER = "openrouter";

const GROQ_CHAT_MODEL = "openai/gpt-oss-20b";
const OPENROUTER_CHAT_MODEL = "stepfun/step-3.5-flash:free";
const TRANSCRIPTION_MODEL = "whisper-large-v3";
const SPEECH_MODEL = "canopylabs/orpheus-v1-english";
const SPEECH_VOICE = "austin";
const SPEECH_FORMAT = "wav";

const aiClients = new Map();

const getProvider = () =>
  (
    process.env.AI_PROVIDER ||
    (process.env.OPENROUTER_API_KEY ? OPENROUTER_PROVIDER : GROQ_PROVIDER)
  )
    .trim()
    .toLowerCase();

const createGroqClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required when using the Groq provider.");
  }

  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
};

const createOpenRouterClient = () => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is required when using the OpenRouter provider."
    );
  }

  return new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
};

const getChatModel = (provider, model) => {
  if (model) {
    return model;
  }

  switch (provider) {
    case OPENROUTER_PROVIDER:
      return OPENROUTER_CHAT_MODEL;
    case GROQ_PROVIDER:
      return GROQ_CHAT_MODEL;
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
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

const getGroqAudioClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "Groq audio support is required for transcription and speech. Add GROQ_API_KEY or switch audio flows to Groq."
    );
  }

  return getClient(GROQ_PROVIDER);
};

const getClient = (provider = getProvider()) => {
  if (aiClients.has(provider)) {
    return aiClients.get(provider);
  }

  switch (provider) {
    case GROQ_PROVIDER: {
      const client = createGroqClient();
      aiClients.set(provider, client);
      return client;
    }
    case OPENROUTER_PROVIDER: {
      const client = createOpenRouterClient();
      aiClients.set(provider, client);
      return client;
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

export const createChatResponse = async ({
  model,
  messages,
  tools,
  toolChoice = "auto",
}) => {
  const provider = getProvider();
  const client = getClient(provider);
  const resolvedModel = getChatModel(provider, model);

  switch (provider) {
    case GROQ_PROVIDER: {
      const response = await client.chat.completions.create({
        model: resolvedModel,
        messages,
        tools,
        tool_choice: toolChoice,
      });

      const choice = response.choices?.[0];

      if (!choice?.message) {
        throw new Error("AI provider returned an empty chat response.");
      }

      return {
        message: choice.message,
        finishReason: choice.finish_reason,
        raw: response,
      };
    }
    case OPENROUTER_PROVIDER: {
      const response = await client.chat.send({
        chatGenerationParams: {
          model: resolvedModel,
          messages: mapMessagesForOpenRouter(messages),
          tools,
          toolChoice,
        },
      });

      const choice = response.choices?.[0];

      if (!choice?.message) {
        throw new Error("AI provider returned an empty chat response.");
      }

      return {
        message: normalizeOpenRouterMessage(choice.message),
        finishReason: choice.finishReason,
        raw: response,
      };
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

export const transcribeAudioFile = async ({
  file,
  model = TRANSCRIPTION_MODEL,
}) => {
  const provider = getProvider();
  const client =
    provider === GROQ_PROVIDER ? getClient(provider) : getGroqAudioClient();

  switch (provider) {
    case GROQ_PROVIDER:
    case OPENROUTER_PROVIDER: {
      const transcription = await client.audio.transcriptions.create({
        file,
        model,
      });

      return transcription.text ?? "";
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

export const generateSpeechAudio = async ({
  text,
  model = SPEECH_MODEL,
  voice = SPEECH_VOICE,
  format = SPEECH_FORMAT,
}) => {
  const provider = getProvider();
  const client =
    provider === GROQ_PROVIDER ? getClient(provider) : getGroqAudioClient();

  switch (provider) {
    case GROQ_PROVIDER:
    case OPENROUTER_PROVIDER: {
      const response = await client.audio.speech.create({
        model,
        input: text,
        voice,
        response_format: format,
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};
