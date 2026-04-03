import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import {
  getAdminAiTrace,
  getAdminErrorLog,
  getAdminNotificationTemplate,
  listAdminAiTraces,
  listAdminErrorLogs,
  listAdminNotificationTemplates,
  listAdminOrganisations,
  previewAdminNotificationTemplate,
  resetAdminNotificationTemplate,
  updateAdminNotificationTemplate,
} from '../controllers/admin.js';

const router = express.Router();

router.use(requireAdminAuth);

router.get('/organisations', listAdminOrganisations);
router.get('/error-logs', listAdminErrorLogs);
router.get('/error-logs/:id', getAdminErrorLog);
router.get('/ai-traces', listAdminAiTraces);
router.get('/ai-traces/:id', getAdminAiTrace);
router.get('/notification-templates', listAdminNotificationTemplates);
router.get('/notification-templates/:type', getAdminNotificationTemplate);
router.put('/notification-templates/:type', updateAdminNotificationTemplate);
router.post('/notification-templates/:type/preview', previewAdminNotificationTemplate);
router.post('/notification-templates/:type/reset', resetAdminNotificationTemplate);

export default router;
