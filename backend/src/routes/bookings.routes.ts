import { Router } from 'express';
import * as ctrl from '../controllers/bookings.controller';
import { authenticate, optionalAuthenticate, requirePermission, requireRole } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.post('/', optionalAuthenticate, ctrl.create);
router.post('/razorpay/order', optionalAuthenticate, ctrl.createRazorpayOrder);
router.post('/razorpay/verify', optionalAuthenticate, ctrl.verifyRazorpayPayment);
router.get('/host/list', authenticate, ctrl.getHostBookings);
router.get('/admin/all', authenticate, requireRole('admin'), ctrl.listAll);
router.get('/:id', authenticate, ctrl.getById);
router.patch('/:id/status', authenticate, requirePermission(PERMISSIONS.BOOKING_EDIT), ctrl.updateStatus);

export default router;
