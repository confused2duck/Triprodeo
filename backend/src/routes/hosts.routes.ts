import { Router } from 'express';
import * as ctrl from '../controllers/hosts.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Dashboard
router.get('/dashboard', requirePermission('dashboard_view'), ctrl.getDashboard);
router.get('/analytics', requirePermission('reports_view'), ctrl.getAnalytics);

// Profile & Settings
router.get('/profile', ctrl.getProfile);
router.patch('/profile', ctrl.updateProfile);
router.patch('/profile/password', ctrl.updatePassword);
router.patch('/profile/bank', ctrl.updateBankDetails);

// Properties
router.get('/properties', requirePermission('property_settings'), ctrl.listProperties);
router.post('/properties', requirePermission('property_settings'), ctrl.createProperty);
router.patch('/properties/:propertyId', requirePermission('property_settings'), ctrl.updateProperty);
router.delete('/properties/:propertyId', requirePermission('property_settings'), ctrl.deleteProperty);

// Bookings
router.get('/bookings', requirePermission('booking_view'), ctrl.listBookings);
router.post('/bookings', requirePermission('booking_create'), ctrl.createWalkInBooking);
router.patch('/bookings/:bookingId/status', requirePermission('booking_edit'), ctrl.updateBookingStatus);

// Reviews
router.get('/reviews', requirePermission('reports_view'), ctrl.listReviews);
router.post('/reviews/:reviewId/reply', requirePermission('reports_view'), ctrl.replyToReview);

// Notifications
router.get('/notifications', ctrl.listNotifications);
router.patch('/notifications/:notificationId/read', ctrl.markNotificationRead);

// Messages
router.get('/messages', requirePermission('guest_messages'), ctrl.listMessages);
router.post('/messages', requirePermission('guest_messages'), ctrl.sendMessage);

// Payouts
router.get('/payouts', requirePermission('payments_view'), ctrl.listPayouts);

// Promotions
router.get('/promotions', requirePermission('property_settings'), ctrl.listPromotions);
router.post('/promotions', requirePermission('property_settings'), ctrl.createPromotion);

export default router;
