import crypto from "crypto";

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export const generateDeliveryOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

export const hashDeliveryOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp || "")).digest("hex");

export const hasOtpExpired = (expiresAt) =>
  !expiresAt || new Date(expiresAt).getTime() < Date.now();

export const buildDeliveryOtpMessage = ({ orderId, otp, organisationName }) =>
  `Your delivery OTP for order ${String(orderId).slice(-8).toUpperCase()} from ${
    organisationName || "the shop"
  } is ${otp}. Share this OTP with the delivery agent. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;

export const resetDeliveryAssignmentState = (delivery = {}) => ({
  ...(delivery?.toObject?.() || delivery || {}),
  agentLiveLocation: {
    latitude: null,
    longitude: null,
    accuracy: null,
    recordedAt: null,
  },
  otpHash: "",
  otpSentAt: null,
  otpExpiresAt: null,
  otpVerifiedAt: null,
  otpAttemptCount: 0,
  completedAt: null,
  completedByUserId: null,
  completionProof: "otp",
  settlementMode: "none",
  settlementAmount: null,
  settlementPaymentId: "",
  settlementRazorpayOrderId: "",
});
