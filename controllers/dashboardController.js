import mongoose from 'mongoose';
import Sale from '../models/sale.js';
import SalePayment from '../models/salePayment.js';
import Purchase from '../models/purchase.js';
import PurchasePayment from '../models/purchasePayment.js';
import Product from '../models/product.js';
import Supplier from '../models/supplier.js';

// ---------- DASHBOARD SUMMARY ----------
export const getDashboardSummary = async (req, res) => {
  try {
    const { org_id } = req.query;

    if (!org_id) {
      return res.status(400).json({ message: 'Organisation ID is required.' });
    }

    const orgObjectId = new mongoose.Types.ObjectId(org_id);

    // ---- SALES SUMMARY ----
    const salesAgg = await Sale.aggregate([
      { $match: { org_id: orgObjectId } },
      {
        $group: {
          _id: null,
          totalSalesAmount: { $sum: '$final_amount' },
          totalPaid: { $sum: '$paid_amount' },
          totalBalance: { $sum: '$balance_amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const salesSummary = salesAgg[0] || {
      totalSalesAmount: 0,
      totalPaid: 0,
      totalBalance: 0,
      count: 0
    };

    // ---- SALE PAYMENTS BY METHOD ----
    const salePaymentsByMethod = await SalePayment.aggregate([
      { $match: { org_id: orgObjectId } },
      {
        $group: {
          _id: '$payment_method',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // ---- PURCHASE SUMMARY ----
    const purchaseAgg = await Purchase.aggregate([
      { $match: { org_id: orgObjectId } },
      {
        $group: {
          _id: null,
          totalPurchasesAmount: { $sum: '$total_amount' },
          totalPaid: { $sum: '$paid_amount' },
          totalBalance: { $sum: '$balance_amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const purchaseSummary = purchaseAgg[0] || {
      totalPurchasesAmount: 0,
      totalPaid: 0,
      totalBalance: 0,
      count: 0
    };

    // ---- PURCHASE PAYMENTS BY METHOD ----
    const purchasePaymentsByMethod = await PurchasePayment.aggregate([
      { $match: { org_id: orgObjectId } },
      {
        $group: {
          _id: '$payment_method',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // ---- INVENTORY SUMMARY ----
    const inventoryAgg = await Product.aggregate([
      { $match: { org_id: orgObjectId } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          // Assuming you have 'price' field in Product
          totalStockValue: { $sum: { $multiply: ['$quantity', '$price'] } }
        }
      }
    ]);

    const inventorySummary = inventoryAgg[0] || {
      totalProducts: 0,
      totalQuantity: 0,
      totalStockValue: 0
    };

    // ---- SUPPLIERS SUMMARY ----
    const supplierCount = await Supplier.countDocuments({ org_id: orgObjectId });

    res.status(200).json({
      message: 'Dashboard summary fetched successfully',
      data: {
        sales: {
          totalAmount: salesSummary.totalSalesAmount,
          paid: salesSummary.totalPaid,
          balance: salesSummary.totalBalance,
          count: salesSummary.count
        },
        salesPayments: {
          byMethod: salePaymentsByMethod,
          doneAmount: salesSummary.totalPaid,
          dueAmount: salesSummary.totalBalance
        },
        purchases: {
          totalAmount: purchaseSummary.totalPurchasesAmount,
          paid: purchaseSummary.totalPaid,
          balance: purchaseSummary.totalBalance,
          count: purchaseSummary.count
        },
        purchasePayments: {
          byMethod: purchasePaymentsByMethod,
          doneAmount: purchaseSummary.totalPaid,
          dueAmount: purchaseSummary.totalBalance
        },
        inventory: inventorySummary,
        suppliers: {
          count: supplierCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};


import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch'; // npm i node-fetch (if not already)

export const getDashboardProjections = async (req, res) => {
  try {
    const { org_id } = req.query;
    if (!org_id) {
      return res.status(400).json({ message: 'Organisation ID is required.' });
    }

    const orgObjectId = new mongoose.Types.ObjectId(org_id);

    // Get last 90 days of sales (grouped by day)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 90);

    const salesHistory = await Sale.aggregate([
      { $match: { org_id: orgObjectId, date: { $gte: sinceDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$final_amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const purchaseHistory = await Purchase.aggregate([
      { $match: { org_id: orgObjectId, date: { $gte: sinceDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$total_amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Prepare text prompt for Gemini
    const prompt = `
You are a financial forecasting assistant.

Given this historical time series, estimate projected sales and purchases for the next 30 days.

Sales history (date, amount):
${salesHistory.map(s => `${s._id}: ${s.total}`).join('\n')}

Purchase history (date, amount):
${purchaseHistory.map(p => `${p._id}: ${p.total}`).join('\n')}

Return a concise JSON with:
{
  "projectedSalesNext30Days": number,
  "projectedPurchasesNext30Days": number,
  "commentary": "short explanation"
}
`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'GEMINI_API_KEY not configured' });
    }

    // Simple REST call to Gemini (example for gemini-1.5-flash)
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const geminiJson = await geminiRes.json();

    // Extract text (depends on model’s response format)
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { rawText: text };
    }

    res.status(200).json({
      message: 'Projections fetched successfully',
      data: parsed
    });

  } catch (error) {
    console.error('Error fetching projections:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
