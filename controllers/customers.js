import Customer from "../models/customer.js";
import Sale from "../models/sale.js";
import mongoose from 'mongoose';

export const getAllCustomers = async (req, res) => {
  try {
    const { org_id } = req.params;

    if (!org_id)
      return res.status(400).json({ message: "Organization ID required" });

    const customers = await Customer.find({ org_id }).sort({ name: 1 });

    res.status(200).json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


export const getAllCustomersWithStats = async (req, res) => {
  try {
    const { org_id } = req.params;

    if (!org_id)
      return res.status(400).json({ message: "Organisation ID required" });

    // Fetch all customers of this org
    const customers = await Customer.find({ org_id });

    const result = [];

    for (const cust of customers) {
      // Fetch all sales for this customer
      const sales = await Sale.find({ customer_id: cust._id });

      const totalPurchase = sales.reduce((sum, s) => sum + s.final_amount, 0);
      const totalBalance = sales.reduce((sum, s) => sum + s.balance_amount, 0);

      result.push({
        _id: cust._id,
        name: cust.name,
        mobile_number: cust.mobile_number,
        totalPurchase,
        totalBalance,
      });
    }

    res.status(200).json({
      message: "Customers fetched successfully",
      customers: result,
    });

  } catch (error) {
    console.error("Error fetching customer list:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Edit customer (Rename)

export const editCustomer = async (req, res) => {
  try {
    const { org_id, id } = req.params;
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Customer name required" });

    const customer = await Customer.findOneAndUpdate(
      { _id: id, org_id },
      { name },
      { new: true }
    );

    res.status(200).json({ message: "Customer updated", customer });

  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Customer sales details

export const getCustomerSalesDetails = async (req, res) => {
  try {
    const { org_id, customer_id } = req.params;

    const customer = await Customer.findOne({ _id: customer_id, org_id });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const sales = await Sale.find({ customer_id })
      .populate("items.product_id", "name p_code price")
      .sort({ date: -1 });

    let totalPurchase = 0;
    let totalBalance = 0;

    sales.forEach(s => {
      totalPurchase += s.final_amount;
      totalBalance += s.balance_amount;
    });

    res.status(200).json({
      customer,
      summary: {
        totalPurchase,
        totalBalance,
        totalSales: sales.length
      },
      sales
    });

  } catch (err) {
    console.error("Error fetching customer details:", err);
    res.status(500).json({ message: "Server error", err });
  }
};

// Add customer
export const createCustomer = async (req, res) => {
  try {
    const { org_id } = req.query;
    const { name, mobile_number } = req.body;

    if (!mobile_number)
      return res.status(400).json({ message: "Mobile number required" });

    const customer = new Customer({
      org_id,
      name,
      mobile_number
    });

    await customer.save();

    res.status(201).json({ message: "Customer created", customer });

  } catch (err) {
    console.error("Error adding customer", err);

    res.status(500).json({
      message: "Server error",
      err
    });
  }
};

// Dues for khatabook functionality

export const getDueCustomers = async (req, res) => {
  try {
    const { org_id } = req.params;

    const customers = await Customer.aggregate([
      { $match: { org_id: new mongoose.Types.ObjectId(org_id) } },

      // Lookup all sales of customer
      {
        $lookup: {
          from: "Sales",
          localField: "_id",
          foreignField: "customer_id",
          as: "sales"
        }
      },

      // Compute total balance
      {
        $addFields: {
          totalBalance: {
            $sum: "$sales.balance_amount"
          }
        }
      },

      // Only customers with due
      { $match: { totalBalance: { $gt: 0 } } },

      // Include total_purchase also
      {
        $addFields: {
          totalPurchase: {
            $sum: "$sales.final_amount"
          }
        }
      },

      {
        $project: {
          name: 1,
          mobile_number: 1,
          totalBalance: 1,
          totalPurchase: 1
        }
      }
    ]);

    res.status(200).json({ customers });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", err });
  }
};


