import express from 'express';
import { captureClientErrorLog } from '../controllers/system.js';
import { attachOptionalActor } from '../middleware/optionalActor.js';

const router = express.Router();

router.post('/error-logs/client', attachOptionalActor, captureClientErrorLog);

export default router;
