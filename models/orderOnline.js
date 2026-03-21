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
      enum: ["pending", "fulfilled", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "upi", "unknown"],
      default: "unknown",
    },
    notes: { type: String, default: "" }, // any special instructions from customer
  },
  { timestamps: true }
);

export default mongoose.model("OnlineOrder", onlineOrderSchema);
