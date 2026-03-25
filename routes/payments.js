import express from "express";
import { razorpayWebhook } from "../controllers/payments.js";

const router = express.Router();

router.post("/razorpay/webhook/:org_id", razorpayWebhook);

export default router;
