import express from "express";
import { recieveMessage } from "../controllers/aiAgent.js";
const router = express.Router();

router.post("/recieve-whatsapp-message", recieveMessage);
router.get("/recieve-whatsapp-message", recieveMessage);

export default router;
