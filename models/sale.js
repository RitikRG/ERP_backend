import mongoose from 'mongoose';

// ---- SALE ITEM SCHEMA ----
const saleItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
}, { _id: false });


// ---- SALE SCHEMA ----
const saleSchema = new mongoose.Schema({

  org_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },

  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },

  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    required: true,
    default: 'pending'
  },

  date: {
    type: Date,
    required: true,
    default: Date.now
  },

  total_amount: {
    type: Number,
    required: true,
    min: 0
  },

  // ===== DISCOUNT FIELDS =====
  discount_type: {
    type: String,
    enum: ['none', 'percent', 'fixed'],
    default: 'none'
  },

  discount_value: {
    type: Number,
    default: 0,
    min: 0
  },

  final_amount: {
    type: Number,
    required: true,
    min: 0
  },

  paid_amount: {
    type: Number,
    required: true,
    min: 0
  },

  balance_amount: {
    type: Number,
    required: true,
    min: 0
  },

  payment_status: {
    type: String,
    enum: ['paid', 'unpaid', 'partial'],
    required: true,
    default: 'unpaid'
  },

  sale_ref: {
    type: String,
    unique: true,
    required: true
  },

  payment_due_date: {
    type: Date,
    required: false
  },

  items: {
    type: [saleItemSchema],
    validate: [(val) => val.length > 0, 'Sale must contain at least one item.']
  }

}, {
  timestamps: true,
  collection: 'Sales'
});


// ---- AUTO CALCULATE DISCOUNT + PAYMENT + SALE REF ----
saleSchema.pre('validate', async function (next) {

  try {
    // ===== APPLY DISCOUNT =====
    let discountAmount = 0;

    if (this.discount_type === 'percent') {
      discountAmount = (this.total_amount * this.discount_value) / 100;

    } else if (this.discount_type === 'fixed') {
      discountAmount = this.discount_value;
    }

    // ===== PAYMENT CALCULATION =====
    if (this.payment_status === 'paid') {
      this.paid_amount = this.final_amount;
      this.balance_amount = 0;

    } else if (this.payment_status === 'partial') {
      if (this.paid_amount > this.final_amount) {
        return next(new Error('Paid amount must be less than final amount for partial payments.'));
      }
      this.balance_amount = this.final_amount - this.paid_amount;

    } else {
      // unpaid
      this.paid_amount = 0;
      this.balance_amount = this.final_amount;
    }

    // ===== SALE REFERENCE GENERATION =====
    if (this.sale_ref) return next();

    const orgId = this.org_id;
    if (!orgId) return next(new Error('Organization ID required to generate sale_ref.'));

    if (!this.sale_ref) {

      const lastSale = await mongoose
        .model('Sale')
        .findOne({ org_id: this.org_id })
        .sort({ createdAt: -1 })
        .select('sale_ref');

      let nextNumber = 1;

      if (lastSale && lastSale.sale_ref) {
        const match = lastSale.sale_ref.match(/SREF_(\d+)/);
        if (match && match[1]) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      this.sale_ref = `SREF_${String(nextNumber).padStart(4, '0')}`;
    }

    next();

  } catch (err) {
    next(err);
  }
});


// ---- VIRTUAL: CONNECT SALE PAYMENTS ----
saleSchema.virtual('payments', {
  ref: 'SalePayment',
  localField: '_id',
  foreignField: 'sale_id'
});

saleSchema.set('toObject', { virtuals: true });
saleSchema.set('toJSON', { virtuals: true });


// ---- EXPORT ----
const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
