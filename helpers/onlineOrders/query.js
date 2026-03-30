export const populateOnlineOrderQuery = (query) =>
  query
    .populate("items.productId", "name p_code")
    .populate(
      "saleId",
      "sale_ref status final_amount paid_amount balance_amount payment_status"
    )
    .populate("delivery.assignedAgentId", "name email phone type isActive")
    .populate("delivery.assignedByUserId", "name email type")
    .populate("delivery.completedByUserId", "name email type");
