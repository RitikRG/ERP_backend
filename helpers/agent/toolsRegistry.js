import Product from "../../models/product.js";
import OnlineOrder from "../../models/orderOnline.js";
import Organisation from "../../models/organisation.js";
import { generateOrderReceiptAssets } from "../orders/orderReceipt.js";
import { createUpiPaymentLink } from "../payments/razorpay.js";

const PAYMENT_LINK_EXPIRY_HOURS = 2;

const buildOnlineOrderItems = (cart) =>
  cart.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    price: item.price,
  }));

const buildOrderConfirmationMessage = ({
  orderId,
  total,
  paymentMethod,
  deliveryAddress,
  paymentLinkUrl = "",
}) => {
  const lines = [
    `Order placed successfully! Order ID: ${orderId}.`,
    `Total: Rs${total}. Payment: ${paymentMethod.toUpperCase()}.`,
  ];

  if (deliveryAddress) {
    lines.push(`Delivery address: ${deliveryAddress}.`);
  }

  if (paymentLinkUrl) {
    lines.push(`Please pay online using this UPI link: ${paymentLinkUrl}`);
  }

  return lines.join(" ");
};

const buildPendingUpiPaymentMessage = ({
  orderId,
  total,
  paymentLinkUrl,
}) =>
  `Please complete your UPI payment for Order ID: ${orderId}. Total: Rs${total}. Pay here: ${paymentLinkUrl} I will confirm your order once the payment is received.`;

/***
 * toolRegistry
 * Each function receives (args, session) where:
 * - args: parsed arguments from LLM tool call
 * - session: { customerNumber, organisationId, cart: [], history: [] }
 */
export const toolRegistry = {
  checkAvailability: async (args, session) => {
    const { productName, quantity } = args;

    const product = await Product.findOne({
      org_id: session.organisationId,
      name: { $regex: productName, $options: "i" },
    }).lean();

    if (!product) {
      return {
        available: false,
        message: `${productName} not found in this shop's inventory.`,
      };
    }

    if (product.quantity < quantity) {
      return {
        available: false,
        productId: product._id,
        productName: product.name,
        currentStock: product.quantity,
        message: `${product.name} is out of stock. Only ${product.quantity} units available.`,
      };
    }

    return {
      available: true,
      productId: product._id,
      productName: product.name,
      price: product.price,
      currentStock: product.quantity,
      message: `${product.name} is available. Price: Rs${product.price} per unit.`,
    };
  },

  addToCart: async (args, session) => {
    const { productId, productName, quantity, price } = args;

    const existingIndex = session.cart.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (existingIndex >= 0) {
      session.cart[existingIndex].quantity += quantity;
    } else {
      session.cart.push({ productId, productName, quantity, price });
    }

    const total = session.cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    return {
      success: true,
      message: `${productName} x${quantity} added to cart.`,
      cartTotal: total,
    };
  },

  getCartSummary: async (args, session) => {
    if (session.cart.length === 0) {
      return { empty: true, message: "Cart is empty." };
    }

    const total = session.cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const itemList = session.cart
      .map(
        (item) =>
          `${item.productName} x${item.quantity} - Rs${item.price * item.quantity}`
      )
      .join(", ");

    return {
      empty: false,
      items: session.cart,
      itemList,
      total,
      message: `Cart: ${itemList}. Total: Rs${total}`,
    };
  },

  clearCart: async (args, session) => {
    session.cart = [];
    return { success: true, message: "Cart cleared." };
  },

  orderNow: async (args, session) => {
    const { paymentMethod, notes, deliveryAddress } = args;

    if (session.cart.length === 0) {
      return { success: false, message: "Cannot place order - cart is empty." };
    }

    session.$locals = session.$locals || {};
    delete session.$locals.paymentLink;
    delete session.$locals.orderReceipt;

    const total = session.cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    let org = null;

    if (paymentMethod === "upi") {
      org = await Organisation.findById(session.organisationId).select(
        "razorpay_key razorpay_secret name"
      );

      if (!org?.razorpay_key || !org?.razorpay_secret) {
        return {
          success: false,
          paymentUnavailable: true,
          message:
            "Online payment is not possible right now. Please choose COD or another available option.",
        };
      }
    }

    const order = await OnlineOrder.create({
      organisationId: session.organisationId,
      customerNumber: session.mobile_number,
      items: buildOnlineOrderItems(session.cart),
      total,
      paymentMethod,
      notes,
      deliveryAddress,
      status: "pending",
    });

    let paymentLinkUrl = "";

    try {
      if (paymentMethod === "upi") {
        const expiresAt = new Date(
          Date.now() + PAYMENT_LINK_EXPIRY_HOURS * 60 * 60 * 1000
        );

        const paymentLink = await createUpiPaymentLink({
          keyId: org.razorpay_key,
          keySecret: org.razorpay_secret,
          amount: total,
          referenceId: String(order._id),
          customerNumber: session.mobile_number,
          description: `Order payment for ${org.name || "shop"} (${order._id})`,
          expireBy: expiresAt,
          notes: {
            organisationId: String(session.organisationId),
            orderId: String(order._id),
            customerNumber: String(session.mobile_number || ""),
          },
        });

        paymentLinkUrl = paymentLink.short_url || "";
        order.onlinePayment = {
          provider: "razorpay",
          linkId: paymentLink.id || "",
          shortUrl: paymentLinkUrl,
          referenceId: paymentLink.reference_id || String(order._id),
          status: paymentLink.status || "created",
          amount: Number(paymentLink.amount || 0) / 100,
          currency: paymentLink.currency || "INR",
          expiresAt: paymentLink.expire_by
            ? new Date(Number(paymentLink.expire_by) * 1000)
            : expiresAt,
          paymentId: "",
          paidAt: null,
          webhookReceivedAt: null,
          confirmationSentAt: null,
        };
        await order.save();

        session.$locals.paymentLink = {
          orderId: order._id,
          shortUrl: paymentLinkUrl,
        };
      }
    } catch (paymentError) {
      await OnlineOrder.findByIdAndDelete(order._id);
      delete session.$locals.paymentLink;
      console.error(
        `[Razorpay] Failed to create payment link for order ${order._id}:`,
        paymentError.message
      );

      return {
        success: false,
        paymentUnavailable: true,
        message:
          "Online payment is not possible right now. Please choose COD or another available option.",
      };
    }

    try {
      if (paymentMethod !== "upi") {
        const receiptAssets = await generateOrderReceiptAssets(order);

        order.receiptImagePath = receiptAssets.publicRelativePath;
        order.receiptImageUrl = receiptAssets.mediaUrl || "";
        order.receiptGeneratedAt = new Date();
        await order.save();

        session.$locals.orderReceipt = {
          orderId: order._id,
          mediaUrl: receiptAssets.mediaUrl,
          receiptImagePath: receiptAssets.publicRelativePath,
        };
      }
    } catch (receiptError) {
      console.error(
        `[OrderReceipt] Failed to generate receipt for order ${order._id}:`,
        receiptError.message
      );
    }

    session.cart = [];

    return {
      success: true,
      orderId: order._id,
      total,
      paymentLinkUrl,
      message:
        paymentMethod === "upi"
          ? buildPendingUpiPaymentMessage({
              orderId: order._id,
              total,
              paymentLinkUrl,
            })
          : buildOrderConfirmationMessage({
              orderId: order._id,
              total,
              paymentMethod,
              deliveryAddress,
              paymentLinkUrl,
            }),
    };
  },

  getCatalog: async (args, session) => {
    const products = await Product.find({
      org_id: session.organisationId,
      quantity: { $gt: 0 },
    })
      .select("name price quantity")
      .lean();

    if (products.length === 0) {
      return { message: "No products currently in stock." };
    }

    const catalog = products.map((p) => `- ${p.name} @ Rs${p.price}`).join("\n");

    return {
      count: products.length,
      catalog,
      message: `${products.length} products available:\n${catalog}`,
    };
  },
};
