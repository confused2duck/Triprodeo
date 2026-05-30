import { Request, Response, NextFunction } from 'express';
import * as bookingsService from '../services/bookings.service';
import * as paymentsService from '../services/payments.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { PERMISSIONS, hasPermission } from '../constants/permissions';

const getHostScopeId = (req: Request) => req.user?.hostId ?? (req.user?.role === 'host' ? req.user.id : undefined);

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      propertyId,
      roomId,
      guestName,
      guestEmail,
      guestPhone,
      guestCount,
      guests,
      roomsRequired,
      checkIn,
      checkOut,
      source: sourceInput,
      paymentMethod,
      notes,
      addOnIds,
      promoCode,
    } = req.body;
    if ((!roomId && !propertyId) || !guestName || !guestEmail || !guestPhone || !checkIn || !checkOut) {
      return sendError(res, 'Missing required booking fields', 400);
    }
    const source = String(sourceInput || 'ONLINE').toUpperCase();
    if (source === 'WALKIN') {
      if (!req.user || !hasPermission(req.user.permissions, PERMISSIONS.BOOKING_CREATE)) {
        return sendError(res, 'Forbidden', 403);
      }
    }
    const booking = await bookingsService.createBooking({
      propertyId,
      roomId,
      guestName,
      guestEmail,
      guestPhone,
      guestCount: guestCount ? parseInt(guestCount) : undefined,
      guests: guests ? parseInt(guests) : undefined,
      roomsRequired: roomsRequired ? parseInt(roomsRequired) : undefined,
      checkIn,
      checkOut,
      source,
      paymentMethod,
      notes,
      addOnIds: Array.isArray(addOnIds) ? addOnIds : undefined,
      promoCode,
      userId: req.user?.role === 'user' ? req.user.id : undefined,
      hostId: getHostScopeId(req),
    });
    sendSuccess(res, booking, 201, 'Booking created');
  } catch (err) { next(err); }
};

export const createRazorpayOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      propertyId,
      roomId,
      guestName,
      guestEmail,
      guestPhone,
      guestCount,
      guests,
      roomsRequired,
      checkIn,
      checkOut,
      notes,
      addOnIds,
      promoCode,
      paymentPercent,
    } = req.body;
    if ((!roomId && !propertyId) || !guestName || !guestEmail || !guestPhone || !checkIn || !checkOut) {
      return sendError(res, 'Missing required booking fields', 400);
    }

    const order = await paymentsService.createRazorpayBookingOrder({
      propertyId,
      roomId,
      guestName,
      guestEmail,
      guestPhone,
      guestCount: guestCount ? parseInt(guestCount) : undefined,
      guests: guests ? parseInt(guests) : undefined,
      roomsRequired: roomsRequired ? parseInt(roomsRequired) : undefined,
      checkIn,
      checkOut,
      notes,
      addOnIds: Array.isArray(addOnIds) ? addOnIds : undefined,
      promoCode,
      paymentPercent: paymentPercent ? Number(paymentPercent) : undefined,
      userId: req.user?.role === 'user' ? req.user.id : undefined,
    });
    sendSuccess(res, order, 201, 'Razorpay order created');
  } catch (err) { next(err); }
};

export const verifyRazorpayPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return sendError(res, 'Missing Razorpay verification fields', 400);
    }
    const booking = await paymentsService.verifyRazorpayBookingPayment({
      bookingId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    sendSuccess(res, booking, 200, 'Payment verified');
  } catch (err) { next(err); }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingsService.getBookingById(
      req.params.id,
      req.user?.id,
      req.user?.role,
      getHostScopeId(req)
    );
    sendSuccess(res, booking);
  } catch (err) { next(err); }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!status) return sendError(res, 'Status required', 400);
    const booking = await bookingsService.updateBookingStatus(
      req.params.id, status, getHostScopeId(req) ?? req.user!.id
    );
    sendSuccess(res, booking);
  } catch (err) { next(err); }
};

export const listAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const page = req.query.page ? Math.max(1, parseInt(String(req.query.page))) : 1;
    const limit = req.query.limit ? Math.max(1, Math.min(100, parseInt(String(req.query.limit)))) : 20;
    
    const result = await bookingsService.getAllBookings(status as any, page, limit);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const getHostBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hostId = getHostScopeId(req);
    if (!hostId) {
      return sendError(res, 'Unauthorized', 401);
    }
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const page = req.query.page ? Math.max(1, parseInt(String(req.query.page))) : 1;
    const limit = req.query.limit ? Math.max(1, Math.min(100, parseInt(String(req.query.limit)))) : 20;
    
    const result = await bookingsService.getHostBookings(hostId, status as any, page, limit);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};
