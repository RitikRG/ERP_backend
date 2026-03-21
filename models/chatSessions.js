import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "tool", "system"],
      required: true,
    },
    content: { type: String, default: null },
    tool_calls: { type: mongoose.Schema.Types.Mixed, default: null }, // LLM tool call objects
    tool_call_id: { type: String, default: null }, // for role: "tool" messages
  },
  { _id: false }
);

const chatSessionsSchema = new mongoose.Schema(
  {
    mobile_number: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    // conversation history — full messages array sent to LLM each turn
    history: {
      type: [messageSchema],
      default: [],
    },

    // current cart — cleared after orderNow
    cart: {
      type: [cartItemSchema],
      default: [],
    },

    // track last activity — use this to auto-expire old sessions
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "ChatSessions",
  }
);

// auto-expire sessions after 2 hours of inactivity
// MongoDB TTL index — deletes the document automatically
chatSessionsSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 7200 });

const ChatSessions = mongoose.model("ChatSessions", chatSessionsSchema);
export default ChatSessions;
