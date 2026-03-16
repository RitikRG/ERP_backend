import mongoose from "mongoose";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsedValue = Number(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
};

const parseChannelMetadata = (value) => {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { raw: value };
    }
  }

  return value;
};

const messageRecievedLogsSchema = new mongoose.Schema(
  {
    SmsMessageSid: {
      type: String,
      trim: true,
      index: true,
    },
    NumMedia: {
      type: Number,
      default: 0,
      min: 0,
      set: toNumber,
    },
    ProfileName: {
      type: String,
      trim: true,
    },
    MessageType: {
      type: String,
      trim: true,
    },
    SmsSid: {
      type: String,
      trim: true,
      index: true,
    },
    WaId: {
      type: String,
      trim: true,
      index: true,
    },
    SmsStatus: {
      type: String,
      trim: true,
    },
    Body: {
      type: String,
      default: "",
    },
    To: {
      type: String,
      trim: true,
    },
    NumSegments: {
      type: Number,
      default: 0,
      min: 0,
      set: toNumber,
    },
    ReferralNumMedia: {
      type: Number,
      default: 0,
      min: 0,
      set: toNumber,
    },
    MessageSid: {
      type: String,
      trim: true,
      index: true,
    },
    AccountSid: {
      type: String,
      trim: true,
      index: true,
    },
    ChannelMetadata: {
      type: mongoose.Schema.Types.Mixed,
      set: parseChannelMetadata,
      default: undefined,
    },
    From: {
      type: String,
      trim: true,
      index: true,
    },
    ApiVersion: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "MessageRecievedLogs",
    strict: false,
  }
);

const MessageRecievedLogs = mongoose.model(
  "MessageRecievedLogs",
  messageRecievedLogsSchema
);

export default MessageRecievedLogs;
