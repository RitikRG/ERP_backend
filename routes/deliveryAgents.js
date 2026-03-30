import express from "express";
import {
  createDeliveryAgent,
  getDeliveryAgents,
  updateDeliveryAgent,
} from "../controllers/deliveryAgents.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireRole(["owner"]));

router.get("/", getDeliveryAgents);
router.post("/", createDeliveryAgent);
router.put("/:agentId", updateDeliveryAgent);

export default router;
