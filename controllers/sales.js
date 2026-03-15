import Sale from "../models/sale.js";
import SalePayment from "../models/salePayment.js";
import Product from "../models/product.js";
import Customer from "../models/customer.js";

// Get all sales
export const getAllSales = async (req, res) => {
  try {
    const org_id = req.params.org_id;

    if (!org_id) {
      return res.status(400).json({ message: "Organisation ID is required." });
    }

    const sales = await Sale.find({ org_id })
      .populate("customer_id", "name mobile_number")
      .populate("items.product_id", "name p_code price")
      .populate("payments")
      .sort({ createdAt: -1 });

    if (!sales || sales.length === 0) {
      return res.status(404).json({ message: "No Sales found." });
    }

    res.status(200).json({
      message: "Sales fetched successfully!",
      sales,
    });

  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({
      message: "Error fetching sales",
      error,
    });
  }
};


// CREATE SALE
export const addSale = async (req, res) => {
  try {
    let {
      org_id,
      customer_id,
      customer_name,
      date,
      items,
      total_amount,
      final_amount,
      paid_amount,
      payment_status,
      payment_due_date,
      payment_date,
      payment_method,
      transaction_id,
      cheque_no
    } = req.body;

    // ITEMS VALIDATION
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Sale items required.' });
    }

    // CUSTOMER HANDLING
    if (!customer_id || customer_id.trim() === '') {
      if (!customer_name) {
        return res.status(400).json({ message: "Customer mobile number required." });
      }

      const newCustomer = new Customer({
        org_id,
        name: "",
        mobile_number: customer_name
      });

      const savedCustomer = await newCustomer.save();
      customer_id = savedCustomer._id;
    }

    // CREATE SALE RECORD
    const sale = new Sale({
      org_id,
      customer_id,
      date,
      items,
      total_amount,
      final_amount,
      paid_amount,
      payment_status,
      payment_due_date
    });

    await sale.save();

    // ADJUST PRODUCT STOCK: reduce quantity
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product_id, {
        $inc: { quantity: -item.quantity }
      });
    }

    // CALCULATE PAYMENT AMOUNT
    let payment_amount = final_amount;

    if (payment_status === 'partial') {
      payment_amount = paid_amount;
    } else if (payment_status === 'unpaid') {
      payment_amount = 0;
    }

    // CREATE PAYMENT ENTRY (only if paid or partially paid)
    if (payment_status === 'paid' || payment_status === 'partial') {
      const salePayment = new SalePayment({
        org_id,
        sale_id: sale._id,
        amount: payment_amount,
        payment_method: payment_method || 'cash',
        transaction_id: transaction_id || null,
        cheque_no: cheque_no || null,
        date: payment_date || new Date(),
      });

      await salePayment.save();
    }

    res.status(201).json({
      message: "Sale created successfully!",
      sale,
    });

  } catch (err) {
    console.error("Error creating sale:", err);
    res.status(500).json({ message: "Server error", err });
  }
};

// EDIT SALE 
export const editSale = async (req, res) => {
  try {
    const saleId = req.params.id;
    const { items, total_amount, paid_amount, payment_status, payment_due_date } = req.body;

    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    // Rollback old quantities
    for (const oldItem of sale.items) {
      await Product.findByIdAndUpdate(oldItem.product_id, {
        $inc: { quantity: oldItem.quantity }
      });
    }

    // Apply new quantities
    for (const newItem of items) {
      await Product.findByIdAndUpdate(newItem.product_id, {
        $inc: { quantity: -newItem.quantity }
      });
    }

    // Update sale fields
    sale.items = items;
    sale.total_amount = total_amount;
    sale.paid_amount = paid_amount;
    sale.payment_status = payment_status;
    sale.payment_due_date = payment_due_date;

    await sale.save();

    res.status(200).json({ message: "Sale updated successfully!", sale });

  } catch (err) {
    console.error("Error editing sale:", err);
    res.status(500).json({ message: "Server error", err });
  }
};


// ADD SALE PAYMENT

export const addSalePayment = async (req, res) => {
  try {
    const { org_id, id } = req.params; // sale ID
    const { amount, payment_method, transaction_id, cheque_no } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Amount must be greater than 0" });

    const sale = await Sale.findById(id).populate("payments");
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    if (String(sale.org_id) !== String(org_id))
      return res.status(403).json({ message: "Unauthorized: Org mismatch" });

    // Use FINAL amount, not total_amount
    const remaining = sale.final_amount - sale.paid_amount;

    if (amount > remaining) {
      return res.status(400).json({
        message: `Payment exceeds remaining balance: ${remaining}`
      });
    }

    // ---------- CREATE PAYMENT ----------
    const payment = new SalePayment({
      org_id,
      sale_id: id,
      amount,
      payment_method,
      transaction_id,
      cheque_no,
    });

    await payment.save();

    // ---------- RECALCULATE TOTAL PAID FROM ALL PAYMENTS ----------
    const allPayments = await SalePayment.find({ sale_id: id });
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

    sale.paid_amount = totalPaid;
    sale.balance_amount = sale.final_amount - totalPaid;

    // ---------- CORRECT PAYMENT STATUS LOGIC ----------
    if (sale.balance_amount === 0) {
      sale.payment_status = "paid";        // convert partial → paid
    } else if (totalPaid > 0) {
      sale.payment_status = "partial";
    } else {
      sale.payment_status = "unpaid";
    }

    // Link payment
    sale.payments.push(payment._id);

    await sale.save();

    res.status(201).json({
      message: "Payment added successfully!",
      sale,
      payment
    });

  } catch (err) {
    console.error("Error adding sale payment:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: "Duplicate transaction ID or cheque number"
      });
    }

    res.status(500).json({ message: "Server error", err });
  }
};


// DELETE SALE (Restore Quantities)
export const deleteSale = async (req, res) => {
  try {
    const { org_id, id } = req.params;

    if (!org_id)
      return res.status(400).json({ message: "Organization ID required." });

    // Fetch sale with product info
    const sale = await Sale.findById(id).populate("items.product_id");

    if (!sale) return res.status(404).json({ message: "Sale not found" });

    // ---- SECURITY CHECK ----
    if (String(sale.org_id) !== String(org_id)) {
      return res.status(403).json({
        message: "Unauthorized: You do not have permission to delete this sale."
      });
    }

    // ---- RESTORE STOCK ----
    for (const item of sale.items) {
      await Product.findByIdAndUpdate(item.product_id._id, {
        $inc: { quantity: item.quantity }
      });
    }

    // ---- DELETE PAYMENTS ----
    await SalePayment.deleteMany({ sale_id: id });

    // ---- DELETE SALE ----
    await Sale.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Sale deleted successfully. Stock restored."
    });

  } catch (err) {
    console.error("Error deleting sale:", err);
    return res.status(500).json({ message: "Server error", err });
  }
};


