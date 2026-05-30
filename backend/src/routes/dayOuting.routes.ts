import { Router } from 'express';
import * as ctrl from '../controllers/dayOuting.controller';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/enquiries', optionalAuthenticate, ctrl.create);
router.get('/enquiries', authenticate, requireRole('admin', 'host', 'staff'), ctrl.list);
router.patch('/enquiries/:id/status', authenticate, requireRole('admin', 'host', 'staff'), ctrl.updateStatus);

export default router;
