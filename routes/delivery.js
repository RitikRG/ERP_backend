import express from "express";
import {
  completeDeliveryOrder,
  createCodRazorpaySettlementOrder,
  getMyDeliveryOrders,
  sendDeliveryOtp,
  updateDeliveryLocation,
} from "../controllers/delivery.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireRole(["delivery_agent"]));

router.get("/orders/me", getMyDeliveryOrders);
router.post("/orders/:orderId/send-otp", sendDeliveryOtp);
router.post("/orders/:orderId/location", updateDeliveryLocation);
router.post("/orders/:orderId/cod/razorpay-order", createCodRazorpaySettlementOrder);
router.post("/orders/:orderId/complete", completeDeliveryOrder);

export default router;
