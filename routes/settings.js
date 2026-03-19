import express from "express";
import { 
  getUserSettings,
  updateUserSettings,
  getOrgSettings,
  updateOrgSettings,
  getSopSettings,
  updateSopSettings,
} from "../controllers/settings.js";

const router = express.Router();

// ---- USER SETTINGS ----
router.get("/user/:org_id", getUserSettings);
router.put("/user/:user_id", updateUserSettings);

// ---- ORG SETTINGS ----
router.get("/org/:org_id", getOrgSettings);
router.put("/org/:org_id", updateOrgSettings);

// ---- SOP SETTINGS ----
router.get("/sop/:org_id", getSopSettings);
router.put("/sop/:org_id", updateSopSettings);

export default router;
