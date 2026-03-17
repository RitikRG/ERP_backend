import mongoose from "mongoose";

const chatSessionsSchema = new mongoose.Schema(
  {
    mobile_number: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "ChatSessions",
  }
);

const ChatSessions = mongoose.model("ChatSessions", chatSessionsSchema);

export default ChatSessions;
