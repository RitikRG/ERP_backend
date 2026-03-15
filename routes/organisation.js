import express from 'express';
import { registerOrganisation } from '../controllers/organisations.js';
const router = express.Router();

router.post('/register', registerOrganisation);
// router.post('/login', login);

export default router;
