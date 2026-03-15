import mongoose from 'mongoose';

const salePaymentSchema = new mongoose.Schema({
  org_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },

  sale_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
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
    unique: true,
    sparse: true,
    required: false,
  },

  cheque_no: {
    type: String,
    unique: true,
    sparse: true,
    required: false,
  },

}, {
  timestamps: true,
  collection: 'SalePayments'
});


// ---------- AUTO-GENERATE SALE PAYMENT REF ----------
salePaymentSchema.pre('validate', async function (next) {
  try {
    // Skip if already generated
    if (this.payment_ref) return next();

    const orgId = this.org_id;
    if (!orgId) {
      return next(new Error('Organization ID required for payment_ref generation.'));
    }

    // Get the last payment for this org
    const lastPayment = await mongoose
      .model('SalePayment')
      .findOne({ org_id: orgId })
      .sort({ createdAt: -1 })   // latest record
      .select('payment_ref');

    let nextNumber = 1;

    if (lastPayment && lastPayment.payment_ref) {
      const match = lastPayment.payment_ref.match(/SPREF_(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Generate unique payment reference
    this.payment_ref = `SPREF_${String(nextNumber).padStart(4, '0')}`;

    next();

  } catch (err) {
    next(err);
  }
});



salePaymentSchema.pre("save", function(next) {
  if (this.transaction_id === "") {
    this.transaction_id = null;
  }
  if (this.cheque_no === "") {
    this.cheque_no = null;
  }
  next();
});


// ---------- EXPORT ----------
const SalePayment = mongoose.model('SalePayment', salePaymentSchema);
export default SalePayment;
