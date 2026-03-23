import MessageRecievedLogs from "../models/messageRecievedLogs.js";
import fetch from "node-fetch";
import twilio from "twilio";
import { getOrganizationByMobileNumber } from "./organisations.js";
import { getOrCreateSession } from "../helpers/agent/sessionHelpers.js";
import { getSopForShop } from "../helpers/agent/sopHelpers.js";
import { runAgentLoop } from "../helpers/agent/agentLoops.js";
import {
  generateSpeechAudio,
  transcribeAudioFile,
} from "../helpers/agent/aiFunctions.js";
import { uploadAudioBuffer } from "../helpers/media/mediaAssets.js";

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/***
 * functionName: transcribeAudio
 * description: transcribe audio to text using the configured AI provider.
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

  const transcription = await transcribeAudioFile({
    file,
  });

  return transcription;
};

/***
 * functionName: textToSpeech
 * description: converts text to audio buffer using the configured AI provider
 */
const textToSpeech = async (text) =>
  generateSpeechAudio({
    text,
    voice: "austin",
  });

/***
 * functionName: sendMessage
 * description: sends a whatsapp message back to the customer.
 * if originalInputWasAudio is true — converts reply to audio and sends as voice note
 * if false — sends as plain text
 */
export const sendMessage = async (
  to,
  replyText,
  originalInputWasAudio,
  options = {}
) => {
  try {
    if (options.mediaUrl) {
      await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
        to,
        body: replyText,
        mediaUrl: [options.mediaUrl],
      });
    } else if (originalInputWasAudio) {
      // convert reply to audio
      const audioBuffer = await textToSpeech(replyText);
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
    const outboundReceipt = session.$locals?.orderReceipt ?? null;

    // update session
    session.lastActivityAt = new Date();
    await session.save();

    // layer 5
    await sendMessage(
      payload.customerNumber,
      reply,
      payload.originalInputWasAudio,
      {
        mediaUrl: outboundReceipt?.mediaUrl,
      }
    );
  } catch (err) {
    console.error("Error in recieveMessage:", err.message);
  }
};
