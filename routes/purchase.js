import express from 'express';
import { createPurchase, getAllPurchases, getPurchaseById, updatePurchaseStatus, addPurchasePayment } from '../controllers/purchase.js';

const router = express.Router();

// Create a new purchase
router.post('/', createPurchase);

// Get all purchases
router.get('/', getAllPurchases);

// Get single purchase
router.get('/:id', getPurchaseById);

// Update purchase status 
router.put("/:org_id/:id/status", updatePurchaseStatus);

// Add new payment
router.post(
  "/org/:org_id/purchase/:id/payment",
  addPurchasePayment
);


export default router;
