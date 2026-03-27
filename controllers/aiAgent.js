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
import {
  buildChoiceSelectionTranscript,
  resolveIncomingChoice,
} from "../helpers/agent/interactiveFlow.js";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const QUICK_REPLY_TEMPLATE_SIDS = {
  2: process.env.TWILIO_QUICK_REPLY_2_CONTENT_SID || "",
  3: process.env.TWILIO_QUICK_REPLY_3_CONTENT_SID || "",
};

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

  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const file = new File([buffer], "audio.ogg", { type: "audio/ogg" });

  return transcribeAudioFile({ file });
};

const textToSpeech = async (text) =>
  generateSpeechAudio({
    text,
    voice: "austin",
  });

const normalizeReplyPayload = (replyPayload) => {
  if (typeof replyPayload === "string") {
    return {
      type: "text",
      message: replyPayload,
    };
  }

  if (!replyPayload || typeof replyPayload !== "object") {
    return {
      type: "text",
      message: "Sorry, something went wrong.",
    };
  }

  return replyPayload;
};

const buildQuickReplyFallbackText = (reply) =>
  [reply.message, ...reply.buttons.map((button) => `- ${button.label}`)].join(
    "\n"
  );

const buildQuickReplyVariables = (reply) => {
  const contentVariables = {
    1: reply.message,
    2: reply.buttons[0]?.label || "",
    3: reply.buttons[0]?.payload || "",
    4: reply.buttons[1]?.label || "",
    5: reply.buttons[1]?.payload || "",
  };

  if (reply.buttons[2]) {
    contentVariables[6] = reply.buttons[2].label;
    contentVariables[7] = reply.buttons[2].payload;
  }

  return JSON.stringify(contentVariables);
};

const sendQuickReplyMessage = async (to, reply) => {
  const contentSid = QUICK_REPLY_TEMPLATE_SIDS[reply.buttons.length];

  if (!contentSid) {
    console.warn(
      `[L5] Quick reply template SID missing for ${reply.buttons.length} buttons. Falling back to text.`
    );
    return false;
  }

  await twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
    to,
    contentSid,
    contentVariables: buildQuickReplyVariables(reply),
  });

  return true;
};

export const sendMessage = async (
  to,
  replyPayload,
  originalInputWasAudio,
  options = {}
) => {
  const reply = normalizeReplyPayload(replyPayload);
  const replyText = reply.message || "";

  try {
    if (reply.type === "buttons") {
      const didSendQuickReply = await sendQuickReplyMessage(to, reply);

      if (!didSendQuickReply) {
        await twilioClient.messages.create({
          from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
          to,
          body: buildQuickReplyFallbackText(reply),
        });
      }
    } else if (options.mediaUrl) {
      await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
        to,
        body: replyText,
        mediaUrl: [options.mediaUrl],
      });
    } else if (originalInputWasAudio) {
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
    console.error("[L5] Message send failed, falling back to text:", err.message);
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
      to,
      body:
        reply.type === "buttons" ? buildQuickReplyFallbackText(reply) : replyText,
    });
  }
};

export const resolveTranscript = async (payload) => {
  if (payload.text) {
    console.log("[L2] Text message - passthrough");
    return payload.text;
  }

  if (payload.audioUrl) {
    console.log("[L2] Voice note - transcribing");
    const transcript = await transcribeAudio(payload.audioUrl);

    if (!transcript || transcript.trim() === "") {
      return "__UNCLEAR_AUDIO__";
    }

    console.log(`[L2] Transcript: ${transcript}`);
    return transcript;
  }

  throw new Error("Payload must have either text or audioUrl");
};

const resolveInboundTranscript = async (reqBody, payload, session) => {
  const selection = resolveIncomingChoice(session, {
    buttonPayload: reqBody.ButtonPayload,
    buttonText: reqBody.ButtonText,
    body: payload.text,
  });

  if (selection) {
    return buildChoiceSelectionTranscript(selection);
  }

  return resolveTranscript(payload);
};

export const recieveMessage = async (req, res) => {
  res.status(200).send();

  try {
    const { From, Body, To, NumMedia, MediaUrl0 } = req.body;

    await MessageRecievedLogs.create(req.body);

    const originalInputWasAudio = NumMedia === "1";
    const payload = {
      customerNumber: From,
      text: originalInputWasAudio ? null : Body,
      audioUrl: originalInputWasAudio ? MediaUrl0 : null,
      originalInputWasAudio,
    };

    const org = await getOrganizationByMobileNumber(To);
    if (!org) {
      await sendMessage(
        payload.customerNumber,
        "Sorry, the shop does not support online orders.",
        originalInputWasAudio
      );
      return;
    }

    const session = await getOrCreateSession(payload.customerNumber, org._id);
    const transcript = await resolveInboundTranscript(req.body, payload, session);

    if (transcript === "__UNCLEAR_AUDIO__") {
      await sendMessage(
        payload.customerNumber,
        "Sorry, I couldn't hear that clearly. Could you type your order or send a clearer voice note?",
        originalInputWasAudio
      );
      return;
    }

    const sop = await getSopForShop(org._id, org);
    const paymentContext = {
      upiEnabled: Boolean(
        sop.payment.upi && org.razorpay_key && org.razorpay_secret
      ),
    };

    const reply = await runAgentLoop(session, transcript, sop, paymentContext);
    const outboundReceipt = session.$locals?.orderReceipt ?? null;
    const outboundPaymentLink = session.$locals?.paymentLink?.shortUrl ?? "";

    if (
      outboundPaymentLink &&
      reply.type === "text" &&
      !reply.message.includes(outboundPaymentLink)
    ) {
      reply.message = `${reply.message}\nPay here: ${outboundPaymentLink}`;
    }

    session.lastActivityAt = new Date();
    await session.save();

    await sendMessage(payload.customerNumber, reply, payload.originalInputWasAudio, {
      mediaUrl: outboundReceipt?.mediaUrl,
    });
  } catch (err) {
    console.error("Error in recieveMessage:", err.message);
  }
};
