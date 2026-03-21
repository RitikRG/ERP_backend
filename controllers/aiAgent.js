import MessageRecievedLogs from "../models/messageRecievedLogs.js";
import Groq from "groq-sdk";
import fetch from "node-fetch";
import twilio from "twilio";
import { v2 as cloudinary } from "cloudinary";
import { getOrganizationByMobileNumber } from "./organisations.js";
import { getOrCreateSession } from "../helpers/agent/sessionHelpers.js";
import { getSopForShop } from "../helpers/agent/sopHelpers.js";
import { runAgentLoop } from "../helpers/agent/agentLoops.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/***
 * functionName: transcribeAudio
 * description: use groq whisper to transcript audio to text.
 */
const transcribeAudio = async (audioUrl) => {
  const response = await fetch(audioUrl, {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64"),
    },
  });

  if (!response.ok)
    throw new Error(`Failed to download audio: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const file = new File([buffer], "audio.ogg", { type: "audio/ogg" });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
  });

  return transcription.text;
};

/***
 * functionName: textToSpeech
 * description: converts text to audio buffer using groq's playai tts model
 */
const textToSpeech = async (text) => {
  const response = await groq.audio.speech.create({
    model: "canopylabs/orpheus-v1-english",
    input: text,
    voice: "austin", // clear, neutral English/Hinglish voice
    response_format: "wav",
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

/***
 * functionName: sendMessage
 * description: sends a whatsapp message back to the customer.
 * if originalInputWasAudio is true — converts reply to audio and sends as voice note
 * if false — sends as plain text
 */
export const sendMessage = async (to, replyText, originalInputWasAudio) => {
  try {
    if (originalInputWasAudio) {
      // convert reply to audio
      const audioBuffer = await textToSpeech(replyText);

      // Twilio needs a publicly accessible URL to send media
      // for now we upload to a temp endpoint on our own server
      // we'll improve this when we set up file hosting
      const mediaUrl = await uploadAudioBuffer(audioBuffer);

      await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
        to,
        mediaUrl: [mediaUrl],
      });
    } else {
      await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
        to,
        body: replyText,
      });
    }

    console.log(`[L5] Message sent to ${to}`);
  } catch (err) {
    // TTS or media failed — fall back to text silently
    console.error("[L5] Audio send failed, falling back to text:", err.message);
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
      to,
      body: replyText,
    });
  }
};

/***
 * functionName: uploadAudioBuffer
 * description: temporarily serves the audio buffer via your own express server
 * returns a publicly accessible URL that Twilio can fetch
 * note: implemented using Cloudinary
 */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadAudioBuffer = async (audioBuffer) => {
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { resource_type: "video", format: "mp3" }, // Cloudinary uses 'video' for audio
        (error, result) => (error ? reject(error) : resolve(result))
      )
      .end(audioBuffer);
  });
  return result.secure_url;
};

export const resolveTranscript = async (payload) => {
  if (payload.text) {
    console.log("[L2] Text message — passthrough");
    return payload.text;
  }

  if (payload.audioUrl) {
    console.log("[L2] Voice note — transcribing via Whisper");
    const transcript = await transcribeAudio(payload.audioUrl);

    if (!transcript || transcript.trim() === "") {
      return "__UNCLEAR_AUDIO__";
    }

    console.log(`[L2] Transcript: ${transcript}`);
    return transcript;
  }

  throw new Error("Payload must have either text or audioUrl");
};

/****
 * The following function recieveMessage forms the layer 1 of our AI Agent, it performs two primary tasks
 * First: It acts as a gateway for the Twillio Webhook to send message to.
 * Second: Store the message received in DB.
 * This function also acts as an orchestrator for the agent
 */
export const recieveMessage = async (req, res) => {
  // respond to Twilio immediately — non-negotiable
  res.status(200).send();

  try {
    const { From, Body, To, NumMedia, MediaUrl0 } = req.body;

    // log the raw message
    await MessageRecievedLogs.create(req.body);

    const originalInputWasAudio = NumMedia === "1";

    // determine message type and hand off to Layer 2
    const payload = {
      customerNumber: From,
      text: originalInputWasAudio ? null : Body,
      audioUrl: originalInputWasAudio ? MediaUrl0 : null,
      originalInputWasAudio,
    };

    // Layer 2 — resolve to transcript
    const transcript = await resolveTranscript(payload);

    if (transcript === "__UNCLEAR_AUDIO__") {
      await sendMessage(
        payload.customerNumber,
        "Sorry, I couldn't hear that clearly. Could you type your order or send a clearer voice note?",
        originalInputWasAudio
      );
      return;
    }

    // Layer 3

    // identify the organisation
    const org = await getOrganizationByMobileNumber(To);
    if (!org || org === null) {
      await sendMessage(
        payload.customerNumber,
        "Sorry, The shop does not support online orders.",
        originalInputWasAudio
      );
      return;
    }
    // Layer 3

    const session = await getOrCreateSession(payload.customerNumber, org._id);
    const sop = await getSopForShop(org._id, org);
    const reply = await runAgentLoop(session, transcript, sop);

    // update session
    session.lastActivityAt = new Date();
    await session.save();

    // layer 5
    await sendMessage(
      payload.customerNumber,
      reply,
      payload.originalInputWasAudio
    );
  } catch (err) {
    console.error("Error in recieveMessage:", err.message);
  }
};
