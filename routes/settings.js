import express from "express";
import { 
  getUserSettings,
  updateUserSettings,
  getOrgSettings,
  updateOrgSettings 
} from "../controllers/settings.js";

const router = express.Router();

// ---- USER SETTINGS ----
router.get("/user/:org_id", getUserSettings);
router.put("/user/:user_id", updateUserSettings);

// ---- ORG SETTINGS ----
router.get("/org/:org_id", getOrgSettings);
router.put("/org/:org_id", updateOrgSettings);

export default router;
