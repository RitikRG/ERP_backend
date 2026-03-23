import Sale from "../../models/sale.js";
import SalePayment from "../../models/salePayment.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const addPaymentToSale = async ({
  orgId,
  saleId,
  amount,
  paymentMethod = "cash",
  transactionId = "",
  chequeNo = "",
  paymentDate = new Date(),
}) => {
  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount <= 0) {
    throw createHttpError(400, "Amount must be greater than 0");
  }

  const sale = await Sale.findById(saleId);

  if (!sale) {
    throw createHttpError(404, "Sale not found");
  }

  if (String(sale.org_id) !== String(orgId)) {
    throw createHttpError(403, "Unauthorized: Org mismatch");
  }

  const remaining = Number(sale.final_amount) - Number(sale.paid_amount || 0);

  if (numericAmount > remaining) {
    throw createHttpError(
      400,
      `Payment exceeds remaining balance: ${remaining}`
    );
  }

  const payment = new SalePayment({
    org_id: orgId,
    sale_id: saleId,
    amount: numericAmount,
    payment_method: paymentMethod || "cash",
    transaction_id: transactionId || "",
    cheque_no: chequeNo || "",
    date: paymentDate || new Date(),
  });

  await payment.save();

  const allPayments = await SalePayment.find({ sale_id: saleId });
  const totalPaid = allPayments.reduce((sum, current) => sum + current.amount, 0);

  sale.paid_amount = totalPaid;
  sale.balance_amount = sale.final_amount - totalPaid;

  if (sale.balance_amount === 0) {
    sale.payment_status = "paid";
  } else if (totalPaid > 0) {
    sale.payment_status = "partial";
  } else {
    sale.payment_status = "unpaid";
  }

  await sale.save();

  return {
    sale,
    payment,
  };
};
