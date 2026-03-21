import express from "express";
import { getAllOnlineOrders } from "../controllers/onlineOrders.js";

const router = express.Router();

router.get("/:org_id", getAllOnlineOrders);

export default router;
