import express from 'express';
import {
  registerSubscription,
  unregisterSubscription,
  getMyNotifications,
  markRead,
  markAllRead
} from '../controllers/notifications.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.post('/subscriptions', registerSubscription);
router.delete('/subscriptions/:deviceId', unregisterSubscription);
router.get('/me', getMyNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:deliveryId/read', markRead);

export default router;
