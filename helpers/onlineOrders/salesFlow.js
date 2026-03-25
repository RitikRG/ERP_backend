import Customer from "../../models/customer.js";
import Product from "../../models/product.js";
import Sale from "../../models/sale.js";
import { syncPaidOnlineOrderToSale } from "./paymentSync.js";

const normalizeCustomerNumber = (customerNumber) => {
  const digits = String(customerNumber || "").replace(/\D/g, "");

  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return null;
};

const resolveCustomer = async (order) => {
  const mobileNumber = normalizeCustomerNumber(order.customerNumber);

  if (!mobileNumber) {
    return null;
  }

  const existingCustomer = await Customer.findOne({
    org_id: order.organisationId,
    mobile_number: mobileNumber,
  });

  if (existingCustomer) {
    return existingCustomer._id;
  }

  try {
    const customer = await Customer.create({
      org_id: order.organisationId,
      name: "",
      mobile_number: mobileNumber,
    });

    return customer._id;
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const duplicateCustomer = await Customer.findOne({
      mobile_number: mobileNumber,
    });

    return duplicateCustomer?._id ?? null;
  }
};

export const createSaleFromOnlineOrder = async (order) => {
  const existingSale = await Sale.findOne({
    online_order_id: order._id,
  });

  if (existingSale) {
    const syncResult = await syncPaidOnlineOrderToSale(order, existingSale);
    return {
      sale: syncResult.sale || existingSale,
      created: false,
    };
  }

  const customerId = await resolveCustomer(order);
  const items = order.items.map((item) => ({
    product_id: item.productId,
    price: item.price,
    quantity: item.quantity,
  }));

  const sale = await Sale.create({
    org_id: order.organisationId,
    customer_id: customerId ?? undefined,
    online_order_id: order._id,
    items,
    date: new Date(),
    total_amount: order.total,
    final_amount: order.total,
    paid_amount: 0,
    payment_status: "unpaid",
  });

  await Promise.all(
    order.items.map((item) =>
      Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: -item.quantity },
      })
    )
  );

  const syncResult = await syncPaidOnlineOrderToSale(order, sale);

  return {
    sale: syncResult.sale || sale,
    created: true,
  };
};
