import crypto from "crypto";
import fetch from "node-fetch";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

export const normalizeCustomerContact = (customerNumber) => {
  const digits = String(customerNumber || "").replace(/\D/g, "");
  return digits || "";
};

export const createUpiPaymentLink = async ({
  keyId,
  keySecret,
  amount,
  referenceId,
  customerNumber,
  description,
  notes = {},
  expireBy,
}) => {
  const payload = {
    amount: Math.round(Number(amount) * 100),
    currency: "INR",
    accept_partial: false,
    reference_id: referenceId,
    description,
    upi_link: false,
    expire_by: toUnixSeconds(expireBy),
    notify: {
      sms: false,
      email: false,
    },
    customer: {
      contact: normalizeCustomerContact(customerNumber),
    },
    notes,
  };

  const response = await fetch(`${RAZORPAY_API_BASE}/payment_links`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let data = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const errorMessage =
      data?.error?.description || data?.error?.reason || response.statusText;
    throw new Error(`Razorpay payment link failed: ${errorMessage}`);
  }

  return data;
};

export const verifyRazorpayWebhookSignature = ({
  rawBody,
  signature,
  secret,
}) => {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const actual = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
};
