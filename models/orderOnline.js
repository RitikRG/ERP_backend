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
    receiptImagePath: { type: String, default: "" },
    receiptImageUrl: { type: String, default: "" },
    receiptGeneratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("OnlineOrder", onlineOrderSchema);
