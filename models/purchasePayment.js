import e from 'express';
import mongoose from 'mongoose';

const purchasePaymentSchema = new mongoose.Schema({
  org_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },

  purchase_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true,
  },

  date: {
    type: Date,
    required: true,
    default: Date.now,
  },

  amount: {
    type: Number,
    required: true,
    min: 0,
  },

  payment_method: {
    type: String,
    enum: ['cash', 'upi', 'cheque', 'transfer', 'others'],
    required: true,
    default: 'cash',
  },

  payment_ref: {
    type: String,
    unique: true,
    required: true,
  },

  transaction_id: {
    type: String,
    sparse: true,
    unique: true,
    required: false,
  },

  cheque_no: {
    type: String,
    sparse: true,
    unique: true,
    required: false,
  },

}, {
  timestamps: true,
  collection: 'PurchasePayments'
});

// ---------- AUTO-GENERATE PAYMENT REF ----------
purchasePaymentSchema.pre("validate", async function (next) {
  try {
    if (this.payment_ref) return next(); // Already set

    const orgId = this.org_id;
    if (!orgId)
      return next(new Error("Organization ID required for payment_ref generation."));

    // 1️⃣ Find last payment for this org
    const lastPayment = await mongoose
      .model("PurchasePayment")
      .findOne({ org_id: orgId })
      .sort({ createdAt: -1 }); // newest first

    let lastNumber = 0;

    // 2️⃣ Extract the numeric portion
    if (lastPayment?.payment_ref) {
      const parts = lastPayment.payment_ref.split("_"); // PPREF_0012 -> ["PPREF", "0012"]
      lastNumber = parseInt(parts[1]) || 0;
    }

    // 3️⃣ Increment
    const newNumber = (lastNumber + 1).toString().padStart(4, "0");

    // 4️⃣ Assign
    this.payment_ref = `PPREF_${newNumber}`;

    next();

  } catch (err) {
    next(err);
  }
});


// Empty string to null
purchasePaymentSchema.pre("save", function(next) {
  if (this.transaction_id === "") {
    this.transaction_id = null;
  }
  if (this.cheque_no === "") {
    this.cheque_no = null;
  }
  next();
});

const PurchasePayment = mongoose.model('PurchasePayment', purchasePaymentSchema);
export default PurchasePayment;
