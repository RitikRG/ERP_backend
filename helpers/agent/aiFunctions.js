import Groq from "groq-sdk";

const DEFAULT_PROVIDER = "groq";

const CHAT_MODEL = "openai/gpt-oss-20b";
const TRANSCRIPTION_MODEL = "whisper-large-v3";
const SPEECH_MODEL = "canopylabs/orpheus-v1-english";
const SPEECH_VOICE = "austin";
const SPEECH_FORMAT = "wav";

let aiClient;

const getProvider = () =>
  (process.env.AI_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();

const createGroqClient = () =>
  new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

const getClient = () => {
  if (aiClient) {
    return aiClient;
  }

  const provider = getProvider();

  switch (provider) {
    case "groq":
      aiClient = createGroqClient();
      return aiClient;
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

export const createChatResponse = async ({
  model = CHAT_MODEL,
  messages,
  tools,
  toolChoice = "auto",
}) => {
  const provider = getProvider();
  const client = getClient();

  switch (provider) {
    case "groq": {
      const response = await client.chat.completions.create({
        model,
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
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

export const transcribeAudioFile = async ({
  file,
  model = TRANSCRIPTION_MODEL,
}) => {
  const provider = getProvider();
  const client = getClient();

  switch (provider) {
    case "groq": {
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
  const client = getClient();

  switch (provider) {
    case "groq": {
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
