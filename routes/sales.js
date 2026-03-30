import express from "express";
import {
  addSale,
  editSale,
  addSalePayment,
  deleteSale,
  getAllSales
} from "../controllers/sales.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireRole(["owner"]));

// Get all sales
router.get('/:org_id', getAllSales);

// Create a new sale
router.post("/sale", addSale);

// Edit an existing sale
router.put("/sale/:id", editSale);

// Add payment to a sale
router.post("/org/:org_id/sale/:id/payment", addSalePayment);

// Delete sale (rollback quantities)
router.delete('/org/:org_id/sale/:id', deleteSale);


export default router;
