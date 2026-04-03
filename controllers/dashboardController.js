import mongoose from 'mongoose';
import Sale from '../models/sale.js';
import SalePayment from '../models/salePayment.js';
import Purchase from '../models/purchase.js';
import PurchasePayment from '../models/purchasePayment.js';
import Product from '../models/product.js';
import Supplier from '../models/supplier.js';
import OnlineOrder from '../models/orderOnline.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const DASHBOARD_TIMEZONE = 'Asia/Kolkata';

const formatDateKey = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DASHBOARD_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
};

const buildDateLabel = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    timeZone: DASHBOARD_TIMEZONE,
    day: 'numeric',
    month: 'short',
  });

const buildOnlineOrderTrend = (rows, days = 7) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trendMap = new Map(
    rows.map((row) => [
      row._id,
      {
        count: row.count || 0,
        totalAmount: row.totalAmount || 0,
      },
    ])
  );

  return Array.from({ length: days }, (_, index) => {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - (days - 1 - index));
    const isoDate = formatDateKey(currentDate);
    const entry = trendMap.get(isoDate) || { count: 0, totalAmount: 0 };

    return {
      date: isoDate,
      label: buildDateLabel(isoDate),
      count: entry.count,
      totalAmount: entry.totalAmount,
    };
  });
};

// ---------- DASHBOARD SUMMARY ----------
export const getDashboardSummary = async (req, res) => {
  try {
    const { org_id } = req.query;

    if (!org_id) {
      return res.status(400).json({ message: 'Organisation ID is required.' });
    }

    const orgObjectId = new mongoose.Types.ObjectId(org_id);
    const onlineOrderTrendSince = new Date();
    onlineOrderTrendSince.setHours(0, 0, 0, 0);
    onlineOrderTrendSince.setDate(onlineOrderTrendSince.getDate() - 6);

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

    // ---- ONLINE ORDERS SUMMARY ----
    const onlineOrdersAgg = await OnlineOrder.aggregate([
      { $match: { organisationId: orgObjectId } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$total' },
          count: { $sum: 1 },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);

    const onlineOrdersSummary = onlineOrdersAgg[0] || {
      totalAmount: 0,
      count: 0,
      averageOrderValue: 0
    };

    const onlineOrdersByStatus = await OnlineOrder.aggregate([
      { $match: { organisationId: orgObjectId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]);

    const onlineOrdersByPaymentMethod = await OnlineOrder.aggregate([
      { $match: { organisationId: orgObjectId } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]);

    const onlineOrdersByFulfillmentMode = await OnlineOrder.aggregate([
      { $match: { organisationId: orgObjectId } },
      {
        $group: {
          _id: '$fulfillmentMode',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]);

    const onlineOrdersTrendRows = await OnlineOrder.aggregate([
      {
        $match: {
          organisationId: orgObjectId,
          createdAt: { $gte: onlineOrderTrendSince }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: DASHBOARD_TIMEZONE
            }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const onlineOrderTrend = buildOnlineOrderTrend(onlineOrdersTrendRows);

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
        },
        onlineOrders: {
          totalAmount: onlineOrdersSummary.totalAmount,
          count: onlineOrdersSummary.count,
          averageOrderValue: Math.round(onlineOrdersSummary.averageOrderValue || 0),
          byStatus: onlineOrdersByStatus,
          byPaymentMethod: onlineOrdersByPaymentMethod,
          byFulfillmentMode: onlineOrdersByFulfillmentMode,
          trend: onlineOrderTrend
        }
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

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
