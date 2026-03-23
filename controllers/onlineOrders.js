import OnlineOrder from "../models/orderOnline.js";
import { createSaleFromOnlineOrder } from "../helpers/onlineOrders/salesFlow.js";
import { addPaymentToSale } from "../helpers/sales/paymentFlow.js";

const SALE_TRIGGER_STATUSES = new Set(["in-delivery", "ready-for-pickup"]);
const ALLOWED_ORDER_STATUSES = [
  "pending",
  "in-delivery",
  "ready-for-pickup",
  "fulfilled",
  "cancelled",
];
const ALLOWED_FULFILLMENT_PAYMENT_STATUSES = ["unpaid", "partial", "paid"];

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseFulfillmentPayment = (payment, sale) => {
  const paymentStatus = String(payment?.paymentStatus || "")
    .trim()
    .toLowerCase();

  if (!ALLOWED_FULFILLMENT_PAYMENT_STATUSES.includes(paymentStatus)) {
    throw createHttpError(
      400,
      "Payment status is required when marking an order as fulfilled."
    );
  }

  const remainingBalance = Number(sale.balance_amount ?? sale.final_amount ?? 0);

  if (paymentStatus === "unpaid" || remainingBalance === 0) {
    return {
      paymentStatus: remainingBalance === 0 ? "paid" : paymentStatus,
      skipPaymentEntry: true,
    };
  }

  const amountWasProvided =
    payment?.amount !== undefined &&
    payment?.amount !== null &&
    String(payment.amount).trim() !== "";
  const amount = amountWasProvided ? Number(payment.amount) : remainingBalance;

  if (!amount || amount <= 0) {
    throw createHttpError(400, "Payment amount must be greater than 0.");
  }

  if (amount > remainingBalance) {
    throw createHttpError(
      400,
      `Payment exceeds remaining balance: ${remainingBalance}`
    );
  }

  if (paymentStatus === "paid" && amount !== remainingBalance) {
    throw createHttpError(
      400,
      `Paid amount must match the remaining balance: ${remainingBalance}`
    );
  }

  if (paymentStatus === "partial" && amount >= remainingBalance) {
    throw createHttpError(
      400,
      "Partial payment must be less than the remaining balance."
    );
  }

  return {
    paymentStatus,
    skipPaymentEntry: false,
    amount,
    paymentMethod: payment?.payment_method || "cash",
    transactionId: payment?.transaction_id || "",
    chequeNo: payment?.cheque_no || "",
  };
};

export const getAllOnlineOrders = async (req, res) => {
  try {
    const organisationId = req.params.org_id;

    if (!organisationId) {
      return res.status(400).json({ message: "Organisation ID is required." });
    }

    const orders = await OnlineOrder.find({ organisationId })
      .populate("items.productId", "name p_code")
      .populate(
        "saleId",
        "sale_ref status final_amount paid_amount balance_amount payment_status"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Online orders fetched successfully!",
      orders,
    });
  } catch (error) {
    console.error("Error fetching online orders:", error);
    return res.status(500).json({
      message: "Error fetching online orders",
      error,
    });
  }
};

export const updateOnlineOrderStatus = async (req, res) => {
  try {
    const { org_id: organisationId, order_id: orderId } = req.params;
    const { status, payment } = req.body;

    if (!organisationId || !orderId) {
      return res.status(400).json({
        message: "Organisation ID and order ID are required.",
      });
    }

    if (!ALLOWED_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${ALLOWED_ORDER_STATUSES.join(", ")}`,
      });
    }

    const order = await OnlineOrder.findOne({
      _id: orderId,
      organisationId,
    });

    if (!order) {
      return res.status(404).json({ message: "Online order not found." });
    }

    let sale = null;
    let saleCreated = false;

    if (SALE_TRIGGER_STATUSES.has(status) || status === "fulfilled") {
      const saleResult = await createSaleFromOnlineOrder(order);
      sale = saleResult.sale;
      saleCreated = saleResult.created;
    }

    if (status === "fulfilled") {
      if (!sale) {
        throw createHttpError(
          500,
          "Sale could not be created for the fulfilled online order."
        );
      }

      const parsedPayment = parseFulfillmentPayment(payment, sale);

      if (!parsedPayment.skipPaymentEntry) {
        const paymentResult = await addPaymentToSale({
          orgId: organisationId,
          saleId: sale._id,
          amount: parsedPayment.amount,
          paymentMethod: parsedPayment.paymentMethod,
          transactionId: parsedPayment.transactionId,
          chequeNo: parsedPayment.chequeNo,
        });
        sale = paymentResult.sale;
      }

      sale.status = "completed";
      await sale.save();
    }

    order.status = status;

    if (sale && (!order.saleId || String(order.saleId) !== String(sale._id))) {
      order.saleId = sale._id;
    }

    await order.save();

    const updatedOrder = await OnlineOrder.findById(order._id)
      .populate("items.productId", "name p_code")
      .populate(
        "saleId",
        "sale_ref status final_amount paid_amount balance_amount payment_status"
      )
      .lean();

    return res.status(200).json({
      message: "Online order status updated successfully.",
      order: updatedOrder,
      saleCreated,
      saleId: sale?._id ?? updatedOrder?.saleId?._id ?? null,
    });
  } catch (error) {
    console.error("Error updating online order status:", error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate transaction ID or cheque number",
      });
    }

    return res.status(500).json({
      message: "Error updating online order status",
      error,
    });
  }
};
