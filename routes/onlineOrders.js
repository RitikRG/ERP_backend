import express from "express";
import {
  assignDeliveryAgent,
  getAllOnlineOrders,
  getOnlineOrderTracking,
  updateOnlineOrderStatus,
} from "../controllers/onlineOrders.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireRole(["owner"]));

router.get("/tracking/:orderId", getOnlineOrderTracking);
router.get("/:org_id", getAllOnlineOrders);
router.put("/:org_id/:order_id/status", updateOnlineOrderStatus);
router.put("/:orderId/assign-agent", assignDeliveryAgent);

export default router;
