import e from 'express';
import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  cost: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
}, { _id: false }); // no need for _id for subdocuments

const purchaseSchema = new mongoose.Schema({
  org_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },

  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: false, // optional if purchases can happen without a supplier
  },

  status: {
    type: String,
    enum: ['ordered', 'recieved', 'cancelled'],
    required: true,
    default: 'ordered',
  },

  date: {
    type: Date,
    required: true,
    default: Date.now,
  },

  total_amount: {
    type: Number,
    required: true,
    min: 0,
  },

  paid_amount: {
    type: Number,
    required: true,
    min: 0,
  },

  balance_amount: {
    type: Number,
    required: true,
    min: 0,
  },

  payment_status: {
    type: String,
    enum: ['paid', 'unpaid', 'partial'],
    required: true,
    default: 'unpaid',
  },

  purchase_ref: {
    type: String,
    unique: true,
    required: true,
  },

  payment_due_date: {
    type: Date,
    required: false,
  },

  items: {
    type: [purchaseItemSchema],
    validate: [(val) => val.length > 0, 'Purchase must have at least one item.'],
  },

}, {
  timestamps: true,
  collection: 'Purchases'
});

// ---------- AUTO-GENERATE Purchase REF ----------
purchaseSchema.pre('validate', async function (next) {
  if (this.purchase_ref) return next(); // already set, skip

  try {

    if (this.payment_status === 'paid') {
      this.paid_amount = this.total_amount;
      this.balance_amount = 0;
    }else if (this.payment_status === 'partial') {
      if (this.paid_amount >= this.total_amount) {
        return next(new Error('Paid amount must be less than total amount for partial payments.'));
      }
      this.balance_amount = this.total_amount - this.paid_amount;
    } else { 
      this.paid_amount = 0;
      this.balance_amount = this.total_amount;
    }

    const orgId = this.org_id;
    if (!orgId) return next(new Error('Organization ID required for payment_ref generation.'));
    
    // Find last purchase for this org sorted by ref (descending)
    const lastPurchase = await mongoose
      .model("Purchase")
      .findOne({ org_id: orgId })
      .sort({ createdAt: -1 });

    let lastNumber = 0;

    if (lastPurchase && lastPurchase.purchase_ref) {
      // purchase_ref looks like: PREF_0012
      const parts = lastPurchase.purchase_ref.split("_");
      lastNumber = parseInt(parts[1]) || 0;
    }

    const newNumber = (lastNumber + 1).toString().padStart(4, "0");
    this.purchase_ref = `PREF_${newNumber}`;

    next();
  } catch (err) {
    next(err);
  }
});

// Connecting PurchasePayments
purchaseSchema.virtual('payments', {
  ref: 'PurchasePayment',        
  localField: '_id',            
  foreignField: 'purchase_id', 
});

purchaseSchema.set('toObject', { virtuals: true });
purchaseSchema.set('toJSON', { virtuals: true });

const Purchase = mongoose.model('Purchase', purchaseSchema);
export default Purchase;
