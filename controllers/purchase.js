import Purchase from '../models/purchase.js';
import Product from '../models/product.js';
import PurchasePayment from '../models/purchasePayment.js';

export const createPurchase = async (req, res) => {
  try {
    const { org_id, supplier_id, status, date, items, payment_status, payment_due_date, total_amount, paid_amount, balance_amount, payment_method, transaction_id, cheque_no, payment_date  } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ message: 'Purchase items are required.' });

    const purchase = new Purchase({
      org_id: org_id,
      supplier_id: supplier_id,
      status: status,
      date: date,
      total_amount: total_amount,
      paid_amount: paid_amount,
      payment_status: payment_status,
      items: items,
      payment_due_date: payment_due_date,
    });

    await purchase.save();

    // Update product stock
    if (status === 'recieved'){
        for (const item of items) {
          await Product.findByIdAndUpdate(item.product_id, {
            $inc: { quantity: item.quantity }
          });
        }
    }

    // Add payment 
    let payment_amount = total_amount;
    if(payment_status=='partial'){
      payment_amount=paid_amount;
    }
    if (payment_status=='paid' ||  payment_status=='partial') {
      const payment = new PurchasePayment({
        org_id,
        purchase_id: purchase._id,
        amount: payment_amount,
        payment_method: payment_method || 'cash',
        transaction_id: transaction_id || '',
        cheque_no: cheque_no || '',
        date: payment_date || new Date(),
      });

      await payment.save();
    }

    res.status(201).json({ message: 'Purchase recorded successfully', purchase });
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getAllPurchases = async (req, res) => {
  try {
    const org_id = req.query.org_id;

    if (!org_id) {
        return res.status(400).json({ message: 'Organisation ID is required.' });
    }
    const purchases = await Purchase.find()
      .populate('supplier_id', 'name company gst email phone')
      .populate('items.product_id', 'name p_code price')
      .populate('payments')
      .sort({ createdAt: -1 });

    if (!purchases) {
        return res.status(404).json({ message: 'No Purchases found.' });
    }
    res.status(200).json({ message: 'Purchases fetched successfully!', purchases});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchases', error });
  }
};

export const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier_id', 'name')
      .populate('items.product_id', 'name p_code price');

    if (!purchase)
      return res.status(404).json({ message: 'Purchase not found' });

    res.status(200).json(purchase);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchase', error });
  }
};

export const updatePurchaseStatus = async (req, res) => {
  try {
    const { id, org_id } = req.params;  
    const { status } = req.body;    

    if (!org_id) {
      return res.status(400).json({ message: "Organisation ID is required." });
    }

    if (!status) {
      return res.status(400).json({ message: "New status is required." });
    }

    // Fetch purchase & verify org
    const purchase = await Purchase.findById(id).populate("items.product_id");

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found." });
    }

    // Validate organisation belongs to user
    if (String(purchase.org_id) !== String(org_id)) {
      return res.status(403).json({
        message: "You are not authorized to modify this purchase."
      });
    }

    // Status unchanged
    if (purchase.status === status) {
      return res.status(400).json({
        message: `Purchase is already marked as ${status}.`
      });
    }

    // Handle ordered -> received
    if (purchase.status === "ordered" && status === "recieved") {
      for (const item of purchase.items) {
        await Product.findByIdAndUpdate(item.product_id._id, {
          $inc: { quantity: item.quantity }
        });
      }
    }

    // Optional: received -> ordered (undo stock)
    if (purchase.status === "recieved" && status === "ordered") {
      for (const item of purchase.items) {
        await Product.findByIdAndUpdate(item.product_id._id, {
          $inc: { quantity: -item.quantity }
        });
      }
    }

    // Update purchase status
    purchase.status = status;
    await purchase.save();

    res.status(200).json({
      message: "Purchase status updated successfully.",
      purchase
    });

  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      message: "Server error updating purchase status.",
      error
    });
  }
};

export const addPurchasePayment = async (req, res) => {
  try {
    const { org_id, id } = req.params; // id = purchase_id
    const { amount, payment_method, transaction_id, cheque_no } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than zero." });
    }

    // Fetch purchase
    const purchase = await Purchase.findById(id).populate("payments");

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found." });
    }

    // Validate organisation
    if (String(purchase.org_id) !== String(org_id)) {
      return res.status(403).json({ message: "Unauthorized: Organisation mismatch." });
    }

    // Prevent overpayment
    if (amount > purchase.balance_amount) {
      return res.status(400).json({
        message: `Payment exceeds balance amount. Remaining balance: ${purchase.balance_amount}`
      });
    }

    // CREATE payment entry
    const newPayment = new PurchasePayment({
      org_id,
      purchase_id: id,
      amount,
      payment_method: payment_method || "cash",
      transaction_id: transaction_id || "",
      cheque_no: cheque_no || "",
    });

    await newPayment.save();

    // Add payment to purchase payments array
    purchase.payments.push(newPayment._id);

    // Update totals
    purchase.paid_amount += amount;
    purchase.balance_amount = purchase.total_amount - purchase.paid_amount;

    // Update payment status
    if (purchase.balance_amount === 0) {
      purchase.payment_status = "paid";
    } else {
      purchase.payment_status = "partial";
    }

    await purchase.save();

    res.status(201).json({
      message: "Payment added successfully",
      payment: newPayment,
      purchase
    });

  } catch (error) {
    console.error("Error adding payment:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate transaction_id or cheque_no detected."
      });
    }

    res.status(500).json({ message: "Server error", error });
  }
};
