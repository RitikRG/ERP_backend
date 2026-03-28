import {
  createGroqChatResponse,
  generateGroqSpeechAudio,
  transcribeGroqAudioFile,
} from "./aiAgents/groqAgent.js";
import {
  createOpenRouterChatResponse,
  generateOpenRouterSpeechAudio,
  transcribeOpenRouterAudioFile,
} from "./aiAgents/openRouterAgent.js";
import {
  createOpenAIChatResponse,
  generateOpenAISpeechAudio,
  transcribeOpenAIAudioFile,
} from "./aiAgents/openAIAgent.js";

const GROQ_PROVIDER = "groq";
const OPENROUTER_PROVIDER = "openrouter";
const OPENAI_PROVIDER = "open_ai";

const getProvider = () =>
  (
    process.env.AI_PROVIDER ||
    (process.env.OPENROUTER_API_KEY ? OPENROUTER_PROVIDER : GROQ_PROVIDER)
  )
    .trim()
    .toLowerCase();

export const createChatResponse = async ({
  model,
  messages,
  tools,
  toolChoice = "auto",
}) => {
  const provider = getProvider();

  switch (provider) {
    case OPENAI_PROVIDER: {
      return createOpenAIChatResponse({
        model,
        messages,
        tools,
        toolChoice,
      });
    }
    case GROQ_PROVIDER: {
      return createGroqChatResponse({
        model,
        messages,
        tools,
        toolChoice,
      });
    }
    case OPENROUTER_PROVIDER: {
      return createOpenRouterChatResponse({
        model,
        messages,
        tools,
        toolChoice,
      });
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

export const transcribeAudioFile = async ({ file, model }) => {
  const provider = getProvider();

  switch (provider) {
    case GROQ_PROVIDER:
      return transcribeGroqAudioFile({ file, model });
    case OPENROUTER_PROVIDER:
      return transcribeOpenRouterAudioFile({ file, model });
    case OPENAI_PROVIDER: {
      return transcribeOpenAIAudioFile({ file, model });
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

export const generateSpeechAudio = async ({ text, model, voice, format }) => {
  const provider = getProvider();

  switch (provider) {
    case GROQ_PROVIDER:
      return generateGroqSpeechAudio({ text, model, voice, format });
    case OPENROUTER_PROVIDER:
      return generateOpenRouterSpeechAudio({ text, model, voice, format });
    case OPENAI_PROVIDER: {
      return generateOpenAISpeechAudio({ text, model, voice, format });
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};
