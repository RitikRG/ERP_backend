/**
 * This is the tools definition, this is sent to the LLM every time processing needs to be
 * done, the way this functions is by choosing from the given list of the functions based on
 * the need and the tool's description, return the name of the function to be executed. Then
 *  the backend itself returns the function.
 */
export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "checkAvailability",
      description:
        "Check if a product is in stock and get its current price. Always call this before addToCart. If the customer mentions any product, call this first.",
      parameters: {
        type: "object",
        properties: {
          productName: {
            type: "string",
            description:
              "The name of the product to check. Use the customer's exact words — do not normalise or guess.",
          },
          quantity: {
            type: "number",
            description:
              "Quantity the customer wants. Default to 1 if not specified.",
          },
        },
        required: ["productName", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addToCart",
      description:
        "Add a product to the customer's cart. Only call this after checkAvailability confirms the item is in stock.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description:
              "The MongoDB _id of the product returned by checkAvailability.",
          },
          productName: {
            type: "string",
            description: "Product name as returned by checkAvailability.",
          },
          quantity: {
            type: "number",
            description: "Quantity to add.",
          },
          price: {
            type: "number",
            description: "Price per unit as returned by checkAvailability.",
          },
        },
        required: ["productId", "productName", "quantity", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCartSummary",
      description:
        "Get the current cart contents and total. Call this when the customer asks what they have ordered so far, or before placing the final order.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clearCart",
      description:
        "Empty the customer's cart. Call this when the customer wants to start over or cancel all items.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "orderNow",
      description:
        "Place the final order. Only call this after the customer has explicitly confirmed they want to place the order. Always call getCartSummary first and read it back to the customer before calling this.",
      parameters: {
        type: "object",
        properties: {
          paymentMethod: {
            type: "string",
            enum: ["cod", "upi", "unknown"],
            description: "Payment method chosen by the customer.",
          },
          notes: {
            type: "string",
            description:
              "Any special instructions from the customer. Empty string if none.",
          },
        },
        required: ["paymentMethod", "notes"],
      },
    },
  },
];
