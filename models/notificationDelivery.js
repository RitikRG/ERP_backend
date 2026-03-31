import mongoose from "mongoose";

const notificationDeliverySchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "NotificationEvent", required: true },
  channel: { type: String, enum: ["push", "in_app"], required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetSubscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "PushSubscription" }, // only for push
  targetDeviceId: { type: String }, // optional, for tracking device context
  status: { 
    type: String, 
    enum: ["queued", "sent", "failed", "read", "clicked"], 
    default: "queued" 
  },
  providerResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  readAt: { type: Date, default: null },
  clickedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: "NotificationDeliveries"
});

notificationDeliverySchema.index({ targetUserId: 1, channel: 1, status: 1 });
notificationDeliverySchema.index({ eventId: 1, status: 1 });

export default mongoose.model("NotificationDelivery", notificationDeliverySchema);
