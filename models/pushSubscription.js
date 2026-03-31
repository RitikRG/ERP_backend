import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organisation", required: true },
  role: { type: String, enum: ["owner", "delivery_agent"], required: true },
  deviceId: { type: String, required: true },
  subscription: {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  userAgent: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  lastSeenAt: { type: Date, default: Date.now },
  lastSuccessfulPushAt: { type: Date },
  lastErrorAt: { type: Date },
}, {
  timestamps: true,
  collection: "PushSubscriptions"
});

pushSubscriptionSchema.index({ user: 1, deviceId: 1 }, { unique: true });
pushSubscriptionSchema.index({ orgId: 1, role: 1, isActive: 1 });

export default mongoose.model("PushSubscription", pushSubscriptionSchema);
