import mongoose from "mongoose";

const notificationEventSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: [
      "online_order_created", 
      "delivery_assigned", 
      "delivery_otp_sent", 
      "delivery_completed", 
      "delivery_cancelled"
    ]
  },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organisation", required: true },
  actorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  audienceRole: [{ type: String, enum: ["owner", "delivery_agent"] }],
  audienceUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "OnlineOrder" },
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
  title: { type: String, required: true },
  body: { type: String, required: true },
  deeplink: { type: String, default: "" },
  payloadSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
  collection: "NotificationEvents"
});

notificationEventSchema.index({ orgId: 1, type: 1 });
notificationEventSchema.index({ audienceRole: 1 });
notificationEventSchema.index({ audienceUsers: 1 });

export default mongoose.model("NotificationEvent", notificationEventSchema);
