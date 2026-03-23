import express from "express";
import {
  getAllOnlineOrders,
  updateOnlineOrderStatus,
} from "../controllers/onlineOrders.js";

const router = express.Router();

router.get("/:org_id", getAllOnlineOrders);
router.put("/:org_id/:order_id/status", updateOnlineOrderStatus);

export default router;
