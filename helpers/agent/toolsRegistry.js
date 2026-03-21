import Product from "../../models/product.js";
import OnlineOrder from "../../models/orderOnline.js";
/***
 * toolRegistry
 * Each function receives (args, session) where:
 * - args: parsed arguments from LLM tool call
 * - session: { customerNumber, organisationId, cart: [], history: [] }
 */
export const toolRegistry = {
  checkAvailability: async (args, session) => {
    const { productName, quantity } = args;

    // fuzzy search — case insensitive, partial match
    // handles "amul butter" matching "Amul Butter 500g"
    const product = await Product.findOne({
      org_id: session.organisationId,
      name: { $regex: productName, $options: "i" },
      // only show active products with quantity tracked
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
      message: `${product.name} is available. Price: ₹${product.price} per unit.`,
    };
  },

  addToCart: async (args, session) => {
    const { productId, productName, quantity, price } = args;

    // check if item already in cart — update quantity instead of adding duplicate
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
      message: `${productName} ×${quantity} added to cart.`,
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
          `${item.productName} ×${item.quantity} — ₹${item.price * item.quantity}`
      )
      .join(", ");

    return {
      empty: false,
      items: session.cart,
      itemList,
      total,
      message: `Cart: ${itemList}. Total: ₹${total}`,
    };
  },

  clearCart: async (args, session) => {
    session.cart = [];
    return { success: true, message: "Cart cleared." };
  },

  orderNow: async (args, session) => {
    const { paymentMethod, notes } = args;

    if (session.cart.length === 0) {
      return { success: false, message: "Cannot place order — cart is empty." };
    }

    const total = session.cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const order = await OnlineOrder.create({
      organisationId: session.organisationId,
      customerNumber: session.customerNumber,
      items: session.cart.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
      total,
      paymentMethod,
      notes,
      status: "pending",
    });

    // clear cart after successful order
    session.cart = [];

    return {
      success: true,
      orderId: order._id,
      total,
      message: `Order placed successfully! Order ID: ${order._id}. Total: ₹${total}. Payment: ${paymentMethod.toUpperCase()}.`,
    };
  },
};
