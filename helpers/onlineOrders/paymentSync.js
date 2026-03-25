import Sale from "../../models/sale.js";
import SalePayment from "../../models/salePayment.js";
import { addPaymentToSale } from "../sales/paymentFlow.js";

export const syncPaidOnlineOrderToSale = async (order, existingSale = null) => {
  const paymentId = order?.onlinePayment?.paymentId || "";

  if (order?.onlinePayment?.status !== "paid" || !paymentId) {
    return {
      synced: false,
      sale: existingSale,
    };
  }

  const sale =
    existingSale ||
    (order?.saleId
      ? await Sale.findById(order.saleId)
      : await Sale.findOne({ online_order_id: order._id }));

  if (!sale) {
    return {
      synced: false,
      sale: null,
    };
  }

  if (!order.saleId || String(order.saleId) !== String(sale._id)) {
    order.saleId = sale._id;
    await order.save();
  }

  const existingPayment = await SalePayment.findOne({
    sale_id: sale._id,
    transaction_id: paymentId,
  });

  if (existingPayment || Number(sale.balance_amount ?? 0) <= 0) {
    return {
      synced: false,
      sale,
    };
  }

  const paymentResult = await addPaymentToSale({
    orgId: order.organisationId,
    saleId: sale._id,
    amount: Number(sale.balance_amount ?? sale.final_amount ?? 0),
    paymentMethod: "upi",
    transactionId: paymentId,
    paymentDate: order.onlinePayment.paidAt || new Date(),
  });

  return {
    synced: true,
    sale: paymentResult.sale,
  };
};
