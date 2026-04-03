import OnlineOrder from "../models/orderOnline.js";
import Organisation from "../models/organisation.js";
import {
  buildDeliveryOtpMessage,
  generateDeliveryOtp,
  hashDeliveryOtp,
  hasOtpExpired,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
} from "../helpers/delivery/deliveryFlow.js";
import { populateOnlineOrderQuery } from "../helpers/onlineOrders/query.js";
import { sendMessage } from "./aiAgent.js";
import { createSaleFromOnlineOrder } from "../helpers/onlineOrders/salesFlow.js";
import { addPaymentToSale } from "../helpers/sales/paymentFlow.js";
import {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
} from "../helpers/payments/razorpay.js";
import {
  buildDeliveryOrderDeeplink,
  buildOwnerOrderDeeplink,
  processNotificationEvent,
} from "../services/notificationService.js";

const DELIVERY_HISTORY_STATUSES = ["fulfilled", "cancelled"];
const DELIVERY_ACTIVE_STATUSES = ["in-delivery"];

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getAssignedOrder = async (orderId, user) => {
  const query = OnlineOrder.findOne({
    _id: orderId,
    organisationId: user.org_id,
    "delivery.assignedAgentId": user._id,
  });

  return populateOnlineOrderQuery(query);
};

const ensureDeliverableAssignedOrder = (order) => {
  if (!order) {
    throw createHttpError(404, "Assigned order not found.");
  }

  if (order.fulfillmentMode !== "delivery") {
    throw createHttpError(400, "Only delivery orders can use this flow.");
  }

  if (["fulfilled", "cancelled"].includes(order.status)) {
    throw createHttpError(400, "This order can no longer be completed.");
  }
};

const ensureOtpCanBeUsed = (order) => {
  if (!order.delivery?.otpHash || !order.delivery?.otpSentAt) {
    throw createHttpError(400, "Delivery OTP has not been sent yet.");
  }

  if (hasOtpExpired(order.delivery?.otpExpiresAt)) {
    throw createHttpError(400, "Delivery OTP has expired. Send a new OTP.");
  }

  if (Number(order.delivery?.otpAttemptCount || 0) >= OTP_MAX_ATTEMPTS) {
    throw createHttpError(400, "Maximum OTP attempts reached. Send a new OTP.");
  }
};

const verifyDeliveryOtpOrThrow = async (order, otp) => {
  ensureOtpCanBeUsed(order);

  if (hashDeliveryOtp(otp) === order.delivery.otpHash) {
    order.delivery.otpVerifiedAt = new Date();
    return true;
  }

  order.delivery.otpAttemptCount = Number(order.delivery.otpAttemptCount || 0) + 1;
  await order.save();

  if (Number(order.delivery.otpAttemptCount || 0) >= OTP_MAX_ATTEMPTS) {
    throw createHttpError(400, "Maximum OTP attempts reached. Send a new OTP.");
  }

  throw createHttpError(400, "Invalid OTP.");
};

const resolveSaleForOrder = async (order) => {
  const saleResult = await createSaleFromOnlineOrder(order);
  const sale = saleResult.sale;

  if (!sale) {
    throw createHttpError(500, "Linked sale could not be created for this order.");
  }

  if (!order.saleId || String(order.saleId) !== String(sale._id)) {
    order.saleId = sale._id;
    await order.save();
  }

  return sale;
};

export const getMyDeliveryOrders = async (req, res) => {
  try {
    const scope = String(req.query.scope || "active").toLowerCase();
    const statuses =
      scope === "history" ? DELIVERY_HISTORY_STATUSES : DELIVERY_ACTIVE_STATUSES;

    const query = OnlineOrder.find({
      organisationId: req.user.org_id,
      "delivery.assignedAgentId": req.user._id,
      status: { $in: statuses },
    }).sort({ createdAt: -1 });

    const orders = await populateOnlineOrderQuery(query).lean();

    return res.status(200).json({
      orders,
      scope,
    });
  } catch (error) {
    console.error("Error fetching delivery orders:", error);
    return res.status(500).json({ message: "Failed to fetch delivery orders." });
  }
};

export const sendDeliveryOtp = async (req, res) => {
  try {
    const order = await getAssignedOrder(req.params.orderId, req.user);
    ensureDeliverableAssignedOrder(order);

    if (order.status !== "in-delivery") {
      throw createHttpError(400, "Only in-delivery orders can send OTP.");
    }

    const organisation = await Organisation.findById(req.user.org_id).select("name");
    const otp = generateDeliveryOtp();
    const sentAt = new Date();
    const expiresAt = new Date(
      sentAt.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000
    );

    order.delivery.otpHash = hashDeliveryOtp(otp);
    order.delivery.otpSentAt = sentAt;
    order.delivery.otpExpiresAt = expiresAt;
    order.delivery.otpVerifiedAt = null;
    order.delivery.otpAttemptCount = 0;
    await order.save();

    await sendMessage(
      order.customerNumber,
      buildDeliveryOtpMessage({
        orderId: order._id,
        otp,
        organisationName: organisation?.name,
      }),
      false
    );

    processNotificationEvent({
      type: 'delivery_otp_sent',
      orgId: req.user.org_id,
      actorUserId: req.user._id,
      targetUserIds: [req.user._id],
      orderId: order._id,
      title: 'Delivery OTP Sent',
      body: `OTP generated for Order #${String(order._id).slice(-6)}`,
      deeplink: buildDeliveryOrderDeeplink(order._id)
    });

    return res.status(200).json({
      message: "Delivery OTP sent successfully.",
      otpSentAt: sentAt,
      otpExpiresAt: expiresAt,
    });
  } catch (error) {
    console.error("Error sending delivery OTP:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to send delivery OTP.",
    });
  }
};

export const updateDeliveryLocation = async (req, res) => {
  try {
    const order = await getAssignedOrder(req.params.orderId, req.user);
    ensureDeliverableAssignedOrder(order);

    if (order.status !== "in-delivery") {
      throw createHttpError(400, "Only in-delivery orders can be tracked.");
    }

    const { latitude, longitude, accuracy } = req.body;
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedAccuracy =
      accuracy === undefined || accuracy === null || accuracy === ""
        ? null
        : Number(accuracy);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      throw createHttpError(400, "Valid latitude and longitude are required.");
    }

    order.delivery.agentLiveLocation = {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      accuracy: Number.isFinite(parsedAccuracy) ? parsedAccuracy : null,
      recordedAt: new Date(),
    };

    await order.save();

    return res.status(200).json({
      message: "Delivery location updated successfully.",
      agentLiveLocation: order.delivery.agentLiveLocation,
    });
  } catch (error) {
    console.error("Error updating delivery location:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to update delivery location.",
    });
  }
};

export const createCodRazorpaySettlementOrder = async (req, res) => {
  try {
    const order = await getAssignedOrder(req.params.orderId, req.user);
    ensureDeliverableAssignedOrder(order);

    if (String(order.paymentMethod || "").toLowerCase() !== "cod") {
      throw createHttpError(400, "Razorpay COD settlement is only for COD orders.");
    }

    const sale = await resolveSaleForOrder(order);
    const remainingBalance = Number(sale.balance_amount ?? sale.final_amount ?? 0);

    if (remainingBalance <= 0) {
      throw createHttpError(400, "This COD order is already fully settled.");
    }

    const organisation = await Organisation.findById(req.user.org_id).select(
      "name razorpay_key razorpay_secret"
    );

    if (!organisation?.razorpay_key || !organisation?.razorpay_secret) {
      throw createHttpError(
        400,
        "Razorpay is not configured for this organisation."
      );
    }

    const razorpayOrder = await createRazorpayOrder({
      keyId: organisation.razorpay_key,
      keySecret: organisation.razorpay_secret,
      amount: remainingBalance,
      receipt: `delivery_${String(order._id).slice(-10)}`,
      notes: {
        online_order_id: String(order._id),
        sale_id: String(sale._id),
        delivery_agent_id: String(req.user._id),
      },
    });

    order.delivery.settlementMode = "razorpay";
    order.delivery.settlementAmount = remainingBalance;
    order.delivery.settlementRazorpayOrderId = razorpayOrder.id || "";
    order.delivery.settlementPaymentId = "";
    await order.save();

    return res.status(200).json({
      message: "Razorpay settlement order created successfully.",
      razorpay: {
        key: organisation.razorpay_key,
        orderId: razorpayOrder.id,
        amount: remainingBalance,
        currency: razorpayOrder.currency || "INR",
        organisationName: organisation.name || "Your Business Name",
      },
    });
  } catch (error) {
    console.error("Error creating COD Razorpay order:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to create COD Razorpay order.",
    });
  }
};

export const completeDeliveryOrder = async (req, res) => {
  try {
    const {
      otp,
      settlementMode = "none",
      amount,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body;

    if (!otp) {
      throw createHttpError(400, "OTP is required to complete delivery.");
    }

    const order = await getAssignedOrder(req.params.orderId, req.user);
    ensureDeliverableAssignedOrder(order);

    if (order.status !== "in-delivery") {
      throw createHttpError(400, "Only in-delivery orders can be completed.");
    }

    await verifyDeliveryOtpOrThrow(order, otp);
    const sale = await resolveSaleForOrder(order);
    const remainingBalance = Number(sale.balance_amount ?? sale.final_amount ?? 0);

    let payment = null;
    const normalizedSettlementMode = String(settlementMode || "none").toLowerCase();

    if (
      String(order.paymentMethod || "").toLowerCase() === "cod" &&
      remainingBalance > 0
    ) {
      if (!["cash", "razorpay"].includes(normalizedSettlementMode)) {
        throw createHttpError(
          400,
          "COD orders require cash or Razorpay settlement before completion."
        );
      }

      const numericAmount = Number(amount);
      if (numericAmount !== remainingBalance) {
        throw createHttpError(
          400,
          `Settlement amount must match the remaining balance: ${remainingBalance}`
        );
      }

      if (normalizedSettlementMode === "cash") {
        const paymentResult = await addPaymentToSale({
          orgId: req.user.org_id,
          saleId: sale._id,
          amount: numericAmount,
          paymentMethod: "cash",
        });
        payment = paymentResult.payment;
      }

      if (normalizedSettlementMode === "razorpay") {
        const organisation = await Organisation.findById(req.user.org_id).select(
          "razorpay_secret"
        );

        if (!organisation?.razorpay_secret) {
          throw createHttpError(
            400,
            "Razorpay is not configured for this organisation."
          );
        }

        const expectedOrderId =
          order.delivery?.settlementRazorpayOrderId || razorpayOrderId;

        if (!expectedOrderId || expectedOrderId !== razorpayOrderId) {
          throw createHttpError(400, "Razorpay order mismatch for this delivery.");
        }

        const isValidPaymentSignature = verifyRazorpayPaymentSignature({
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: razorpaySignature,
          secret: organisation.razorpay_secret,
        });

        if (!isValidPaymentSignature) {
          throw createHttpError(400, "Invalid Razorpay payment signature.");
        }

        const paymentResult = await addPaymentToSale({
          orgId: req.user.org_id,
          saleId: sale._id,
          amount: numericAmount,
          paymentMethod: "upi",
          transactionId: razorpayPaymentId,
        });
        payment = paymentResult.payment;
      }
    }

    sale.status = "completed";
    await sale.save();

    order.status = "fulfilled";
    order.delivery.otpHash = "";
    order.delivery.otpVerifiedAt = order.delivery.otpVerifiedAt || new Date();
    order.delivery.completedAt = new Date();
    order.delivery.completedByUserId = req.user._id;
    order.delivery.completionProof = "otp";
    order.delivery.settlementMode =
      remainingBalance > 0 ? normalizedSettlementMode : "none";
    order.delivery.settlementAmount =
      payment?.amount ?? (remainingBalance > 0 ? Number(amount) : null);
    order.delivery.settlementPaymentId =
      payment?.transaction_id || payment?._id?.toString?.() || "";

    if (normalizedSettlementMode !== "razorpay") {
      order.delivery.settlementRazorpayOrderId =
        order.delivery?.settlementRazorpayOrderId || "";
    }

    await order.save();

    const updatedOrder = await populateOnlineOrderQuery(
      OnlineOrder.findById(order._id)
    ).lean();

    processNotificationEvent({
      type: 'delivery_completed',
      orgId: req.user.org_id,
      actorUserId: req.user._id,
      targetRoles: ['owner'],
      orderId: order._id,
      title: 'Delivery Completed',
      body: `Order #${String(order._id).slice(-6)} was successfully delivered.`,
      deeplink: buildOwnerOrderDeeplink(order._id)
    });

    processNotificationEvent({
      type: 'delivery_completed',
      orgId: req.user.org_id,
      actorUserId: req.user._id,
      targetUserIds: [req.user._id],
      orderId: order._id,
      title: 'Delivery Completed',
      body: `Order #${String(order._id).slice(-6)} was successfully delivered.`,
      deeplink: buildDeliveryOrderDeeplink(order._id, 'history')
    });

    return res.status(200).json({
      message: "Delivery completed successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error completing delivery order:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to complete delivery order.",
    });
  }
};
