import mongoose from "mongoose";

const onlineOrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const deliveryLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const orderDeliverySchema = new mongoose.Schema(
  {
    agentLiveLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      recordedAt: { type: Date, default: null },
    },
    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: { type: Date, default: null },
    otpHash: { type: String, default: "" },
    otpSentAt: { type: Date, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpVerifiedAt: { type: Date, default: null },
    otpAttemptCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    completedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completionProof: {
      type: String,
      enum: ["otp"],
      default: "otp",
    },
    settlementMode: {
      type: String,
      enum: ["none", "cash", "razorpay"],
      default: "none",
    },
    settlementAmount: { type: Number, default: null },
    settlementPaymentId: { type: String, default: "" },
    settlementRazorpayOrderId: { type: String, default: "" },
  },
  { _id: false }
);

const onlineOrderSchema = new mongoose.Schema(
  {
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
      required: true,
    },
    customerNumber: {
      type: String,
      required: true, // whatsapp:+919876543210
    },
    items: [onlineOrderItemSchema],
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "in-delivery",
        "ready-for-pickup",
        "fulfilled",
        "cancelled",
      ],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "upi", "unknown"],
      default: "unknown",
    },
    fulfillmentMode: {
      type: String,
      enum: ["delivery", "pickup", "unknown"],
      default: "unknown",
    },
    onlinePayment: {
      provider: { type: String, default: "" },
      linkId: { type: String, default: "" },
      shortUrl: { type: String, default: "" },
      referenceId: { type: String, default: "" },
      status: { type: String, default: "" },
      amount: { type: Number, default: null },
      currency: { type: String, default: "INR" },
      expiresAt: { type: Date, default: null },
      paymentId: { type: String, default: "" },
      paidAt: { type: Date, default: null },
      webhookReceivedAt: { type: Date, default: null },
      confirmationSentAt: { type: Date, default: null },
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
    },
    notes: { type: String, default: "" }, // any special instructions from customer
    deliveryAddress: { type: String, default: "" },
    deliveryLocation: {
      type: deliveryLocationSchema,
      default: () => ({
        latitude: null,
        longitude: null,
        address: "",
        label: "",
      }),
    },
    receiptImagePath: { type: String, default: "" },
    receiptImageUrl: { type: String, default: "" },
    receiptGeneratedAt: { type: Date, default: null },
    delivery: {
      type: orderDeliverySchema,
      default: () => ({
        agentLiveLocation: {
          latitude: null,
          longitude: null,
          accuracy: null,
          recordedAt: null,
        },
        assignedAgentId: null,
        assignedByUserId: null,
        assignedAt: null,
        otpHash: "",
        otpSentAt: null,
        otpExpiresAt: null,
        otpVerifiedAt: null,
        otpAttemptCount: 0,
        completedAt: null,
        completedByUserId: null,
        completionProof: "otp",
        settlementMode: "none",
        settlementAmount: null,
        settlementPaymentId: "",
        settlementRazorpayOrderId: "",
      }),
    },
  },
  { timestamps: true }
);

onlineOrderSchema.index({
  organisationId: 1,
  status: 1,
  "delivery.assignedAgentId": 1,
});

export default mongoose.model("OnlineOrder", onlineOrderSchema);
