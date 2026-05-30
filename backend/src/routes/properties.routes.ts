import { Router } from 'express';
import * as ctrl from '../controllers/properties.controller';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', optionalAuthenticate, ctrl.list);
router.get('/locations', ctrl.locations);
router.get('/tags', ctrl.tags);
router.get('/exclusive', ctrl.exclusive);
router.get('/tag/:tag', ctrl.byTag);
router.get('/:id', ctrl.getById);
router.get('/:id/reviews', ctrl.getReviews);
router.get('/:id/availability', ctrl.checkAvailability);
router.post('/', authenticate, requireRole('host', 'admin'), ctrl.create);
router.patch('/:id', authenticate, requireRole('host', 'admin'), ctrl.update);
router.patch('/:id/approve', authenticate, requireRole('admin'), ctrl.approve);

export default router;
