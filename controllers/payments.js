import OnlineOrder from "../models/orderOnline.js";
import Organisation from "../models/organisation.js";
import { verifyRazorpayWebhookSignature } from "../helpers/payments/razorpay.js";
import { syncPaidOnlineOrderToSale } from "../helpers/onlineOrders/paymentSync.js";
import { generateOrderReceiptAssets } from "../helpers/orders/orderReceipt.js";
import { sendMessage } from "./aiAgent.js";

const mapPaymentLinkStatus = (eventName, paymentLinkEntity) => {
  if (eventName === "payment_link.paid") return "paid";
  if (eventName === "payment_link.cancelled") return "cancelled";
  if (eventName === "payment_link.expired") return "expired";
  if (eventName === "payment_link.partially_paid") return "partially_paid";

  return paymentLinkEntity?.status || "";
};

const buildPaidOrderConfirmationMessage = (order) => {
  const lines = [
    `Payment received successfully! Your order is confirmed.`,
    `Order ID: ${order._id}. Total: Rs${order.total}. Payment: UPI.`,
  ];

  if (order.deliveryAddress) {
    lines.push(`Delivery address: ${order.deliveryAddress}.`);
  }

  return lines.join(" ");
};

export const razorpayWebhook = async (req, res) => {
  try {
    const { org_id: organisationId } = req.params;
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : String(req.body || "");

    const organisation = await Organisation.findById(organisationId).select(
      "razorpay_webhook_secret"
    );

    if (!organisation?.razorpay_webhook_secret) {
      return res.status(400).json({
        message: "Razorpay webhook secret is not configured for this organisation.",
      });
    }

    const isValidSignature = verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      secret: organisation.razorpay_webhook_secret,
    });

    if (!isValidSignature) {
      return res.status(400).json({ message: "Invalid Razorpay signature." });
    }

    const payload = JSON.parse(rawBody || "{}");
    const paymentLinkEntity = payload?.payload?.payment_link?.entity;
    const paymentEntity = payload?.payload?.payment?.entity;

    if (!paymentLinkEntity?.id && !paymentLinkEntity?.reference_id) {
      return res.status(200).json({ message: "Webhook ignored." });
    }

    const order = await OnlineOrder.findOne({
      organisationId,
      $or: [
        { "onlinePayment.linkId": paymentLinkEntity.id || "" },
        { "onlinePayment.referenceId": paymentLinkEntity.reference_id || "" },
        { _id: paymentLinkEntity.reference_id || null },
      ],
    });

    if (!order) {
      return res.status(200).json({ message: "Order not found for webhook." });
    }

    order.onlinePayment = {
      ...(order.onlinePayment?.toObject?.() || order.onlinePayment || {}),
      provider: "razorpay",
      linkId: paymentLinkEntity.id || order.onlinePayment?.linkId || "",
      shortUrl:
        paymentLinkEntity.short_url || order.onlinePayment?.shortUrl || "",
      referenceId:
        paymentLinkEntity.reference_id ||
        order.onlinePayment?.referenceId ||
        String(order._id),
      status: mapPaymentLinkStatus(payload.event, paymentLinkEntity),
      amount:
        Number(paymentLinkEntity.amount || 0) > 0
          ? Number(paymentLinkEntity.amount) / 100
          : order.onlinePayment?.amount || order.total,
      currency: paymentLinkEntity.currency || order.onlinePayment?.currency || "INR",
      expiresAt: paymentLinkEntity.expire_by
        ? new Date(Number(paymentLinkEntity.expire_by) * 1000)
        : order.onlinePayment?.expiresAt || null,
      paymentId: paymentEntity?.id || order.onlinePayment?.paymentId || "",
      paidAt:
        payload.event === "payment_link.paid"
          ? new Date()
          : order.onlinePayment?.paidAt || null,
      webhookReceivedAt: new Date(),
    };

    await order.save();
    await syncPaidOnlineOrderToSale(order);

    if (
      payload.event === "payment_link.paid" &&
      !order.onlinePayment?.confirmationSentAt
    ) {
      try {
        const receiptAssets = await generateOrderReceiptAssets(order);
        order.receiptImagePath = receiptAssets.publicRelativePath;
        order.receiptImageUrl = receiptAssets.mediaUrl || "";
        order.receiptGeneratedAt = new Date();
      } catch (receiptError) {
        console.error(
          `[OrderReceipt] Failed to generate receipt for paid order ${order._id}:`,
          receiptError.message
        );
      }

      await sendMessage(
        order.customerNumber,
        buildPaidOrderConfirmationMessage(order),
        false,
        {
          mediaUrl: order.receiptImageUrl || undefined,
        }
      );

      order.onlinePayment = {
        ...(order.onlinePayment?.toObject?.() || order.onlinePayment || {}),
        confirmationSentAt: new Date(),
      };
      await order.save();
    }

    return res.status(200).json({ message: "Webhook processed successfully." });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return res.status(500).json({ message: "Webhook processing failed." });
  }
};
