import express from 'express';
import { loginAdmin, logoutAdmin, refreshAdmin } from '../controllers/adminAuth.js';

const router = express.Router();

router.post('/login', loginAdmin);
router.post('/refresh', refreshAdmin);
router.post('/logout', logoutAdmin);

export default router;
