const OPENAI_CHAT_MODEL = "gpt-4o-mini";
const OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const OPENAI_SPEECH_MODEL = "gpt-4o-mini-tts";
const OPENAI_DEFAULT_VOICE = "alloy";
const OPENAI_BASE_URL =
  (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  );
const OPENAI_SUPPORTED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
]);

const getOpenAIApiKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required when using the OPEN_AI provider."
    );
  }

  return process.env.OPENAI_API_KEY;
};

const buildOpenAIUrl = (path) => `${OPENAI_BASE_URL}${path}`;

const parseOpenAIError = async (response) => {
  const fallbackMessage = `OpenAI request failed with status ${response.status}.`;

  try {
    const payload = await response.json();
    return payload?.error?.message || fallbackMessage;
  } catch {
    try {
      const text = await response.text();
      return text || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }
};

const openAIJsonRequest = async (path, body) => {
  const response = await fetch(buildOpenAIUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseOpenAIError(response));
  }

  return response.json();
};

const openAIFormRequest = async (path, formData) => {
  const response = await fetch(buildOpenAIUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseOpenAIError(response));
  }

  return response.json();
};

const openAIBinaryRequest = async (path, body) => {
  const response = await fetch(buildOpenAIUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseOpenAIError(response));
  }

  return Buffer.from(await response.arrayBuffer());
};

const normalizeOpenAIVoice = (voice) => {
  const normalizedVoice = (voice || "").trim().toLowerCase();

  if (OPENAI_SUPPORTED_VOICES.has(normalizedVoice)) {
    return normalizedVoice;
  }

  return process.env.OPENAI_SPEECH_VOICE || OPENAI_DEFAULT_VOICE;
};

const normalizeOpenAISpeechFormat = (format) => {
  const normalizedFormat = (format || "").trim().toLowerCase();

  if (["mp3", "opus", "aac", "flac", "wav", "pcm"].includes(normalizedFormat)) {
    return normalizedFormat;
  }

  return "wav";
};

export const createOpenAIChatResponse = async ({
  model,
  messages,
  tools,
  toolChoice = "auto",
}) => {
  const response = await openAIJsonRequest("/chat/completions", {
    model: model || process.env.OPENAI_CHAT_MODEL || OPENAI_CHAT_MODEL,
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
};

export const transcribeOpenAIAudioFile = async ({ file, model }) => {
  const formData = new FormData();
  formData.append("file", file, file.name || "audio.ogg");
  formData.append(
    "model",
    model || process.env.OPENAI_TRANSCRIPTION_MODEL || OPENAI_TRANSCRIPTION_MODEL
  );
  formData.append("response_format", "json");

  const transcription = await openAIFormRequest(
    "/audio/transcriptions",
    formData
  );

  return transcription.text ?? "";
};

export const generateOpenAISpeechAudio = async ({
  text,
  model,
  voice,
  format,
}) =>
  openAIBinaryRequest("/audio/speech", {
    model: model || process.env.OPENAI_SPEECH_MODEL || OPENAI_SPEECH_MODEL,
    input: text,
    voice: normalizeOpenAIVoice(voice),
    response_format: normalizeOpenAISpeechFormat(format),
  });
