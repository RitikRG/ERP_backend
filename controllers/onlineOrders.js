import OnlineOrder from "../models/orderOnline.js";

export const getAllOnlineOrders = async (req, res) => {
  try {
    const organisationId = req.params.org_id;

    if (!organisationId) {
      return res.status(400).json({ message: "Organisation ID is required." });
    }

    const orders = await OnlineOrder.find({ organisationId })
      .populate("items.productId", "name p_code")
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
