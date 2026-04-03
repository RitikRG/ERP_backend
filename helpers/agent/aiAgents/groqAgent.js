import Groq from "groq-sdk";

const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";
const TRANSCRIPTION_MODEL = "whisper-large-v3";
const SPEECH_MODEL = "canopylabs/orpheus-v1-english";
const SPEECH_VOICE = "austin";
const SPEECH_FORMAT = "wav";

let groqClient;

const getClient = () => {
  if (groqClient) {
    return groqClient;
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required when using the Groq provider.");
  }

  groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  return groqClient;
};

export const createGroqChatResponse = async ({
  model,
  messages,
  tools,
  toolChoice = "auto",
}) => {
  const resolvedModel = model || GROQ_CHAT_MODEL;
  const response = await getClient().chat.completions.create({
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
    provider: 'groq',
    model: response.model || resolvedModel,
    usage: response.usage || null,
    raw: response,
  };
};

export const transcribeGroqAudioFile = async ({
  file,
  model = TRANSCRIPTION_MODEL,
}) => {
  const transcription = await getClient().audio.transcriptions.create({
    file,
    model,
  });

  return transcription.text ?? "";
};

export const generateGroqSpeechAudio = async ({
  text,
  model = SPEECH_MODEL,
  voice = SPEECH_VOICE,
  format = SPEECH_FORMAT,
}) => {
  const response = await getClient().audio.speech.create({
    model,
    input: text,
    voice,
    response_format: format,
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
