// backend/routes/dashboard.js
import express from 'express';
import { getDashboardSummary, getDashboardProjections } from '../controllers/dashboardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireRole(['owner']));

// /api/dashboard/summary?org_id=...
router.get('/summary', getDashboardSummary);

// /api/dashboard/projections?org_id=...
router.get('/projections', getDashboardProjections);

export default router;
