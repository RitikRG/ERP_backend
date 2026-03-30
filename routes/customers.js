import express from "express";
import {
  getAllCustomers, getAllCustomersWithStats, editCustomer, getCustomerSalesDetails, createCustomer, getDueCustomers
} from "../controllers/customers.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireRole(["owner"]));

// Get all customers
router.get("/:org_id", getAllCustomers);

router.get("/:org_id/list", getAllCustomersWithStats);
router.put("/:org_id/:id", editCustomer);
router.get("/:org_id/:customer_id/details", getCustomerSalesDetails);
router.post("/create", createCustomer);
router.get("/:org_id/due", getDueCustomers);


export default router;
