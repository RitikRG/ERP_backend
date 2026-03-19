import mongoose from "mongoose";

const sopSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
      default: null,
    },

    delivery: {
      enabled: { type: Boolean, default: true },
      minimumOrder: { type: Number, default: 150 },
      hoursStart: { type: String, default: "09:00" },
      hoursEnd: { type: String, default: "21:00" },
      days: { type: String, default: "Monday to Saturday" },
    },

    payment: {
      cod: { type: Boolean, default: true },
      upi: { type: Boolean, default: true },
    },

    shop: {
      openTime: { type: String, default: "09:00" },
      closeTime: { type: String, default: "21:00" },
      weeklyOff: { type: String, default: "Sunday" },
      contact: { type: String, default: "" },
    },

    rules: {
      allowSubstitutions: { type: Boolean, default: true },
      partialOrders: { type: Boolean, default: true },
      maxItems: { type: Number, default: null },
      specialInstructions: { type: String, default: "" },
    },

    isGlobal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ShopSOP = mongoose.model("ShopSOP", sopSchema);

export default ShopSOP;
