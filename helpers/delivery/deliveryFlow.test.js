import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeliveryOtpMessage,
  generateDeliveryOtp,
  hashDeliveryOtp,
  hasOtpExpired,
  resetDeliveryAssignmentState,
} from "./deliveryFlow.js";

test("generateDeliveryOtp returns a 6 digit string", () => {
  const otp = generateDeliveryOtp();

  assert.match(otp, /^\d{6}$/);
});

test("hashDeliveryOtp is deterministic", () => {
  assert.equal(hashDeliveryOtp("123456"), hashDeliveryOtp("123456"));
  assert.notEqual(hashDeliveryOtp("123456"), hashDeliveryOtp("123457"));
});

test("hasOtpExpired checks past and future timestamps", () => {
  assert.equal(hasOtpExpired(new Date(Date.now() - 1000)), true);
  assert.equal(hasOtpExpired(new Date(Date.now() + 1000)), false);
});

test("resetDeliveryAssignmentState clears transient delivery fields", () => {
  const reset = resetDeliveryAssignmentState({
    otpHash: "abc",
    otpSentAt: new Date(),
    otpExpiresAt: new Date(),
    otpVerifiedAt: new Date(),
    otpAttemptCount: 3,
    settlementMode: "razorpay",
    settlementAmount: 99,
    settlementPaymentId: "pay_1",
    settlementRazorpayOrderId: "order_1",
  });

  assert.equal(reset.otpHash, "");
  assert.equal(reset.otpAttemptCount, 0);
  assert.equal(reset.settlementMode, "none");
  assert.equal(reset.settlementPaymentId, "");
});

test("buildDeliveryOtpMessage includes short order id and otp", () => {
  const message = buildDeliveryOtpMessage({
    orderId: "67f123456789abcd1234ef90",
    otp: "654321",
    organisationName: "My Shop",
  });

  assert.match(message, /My Shop/);
  assert.match(message, /654321/);
  assert.match(message, /1234EF90/);
});
