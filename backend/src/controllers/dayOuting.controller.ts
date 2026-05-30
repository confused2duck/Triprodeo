import { Request, Response, NextFunction } from 'express';
import * as dayOutingService from '../services/dayOuting.service';
import { sendError, sendSuccess } from '../utils/response.util';

const getHostScopeId = (req: Request) => req.user?.hostId ?? (req.user?.role === 'host' ? req.user.id : undefined);

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      propertyId,
      guestName,
      guestEmail,
      guestPhone,
      date,
      timeSlot,
      timeRange,
      packageTitle,
      guests,
      pricePerPerson,
      estimatedTotal,
      occasion,
      specialRequests,
    } = req.body;

    if (!propertyId || !guestName || !guestEmail || !date || !timeSlot) {
      return sendError(res, 'propertyId, guestName, guestEmail, date and timeSlot are required', 400);
    }

    const enquiry = await dayOutingService.createDayOutingEnquiry({
      propertyId,
      guestName,
      guestEmail,
      guestPhone,
      date,
      timeSlot,
      timeRange,
      packageTitle,
      guests: Number(guests),
      pricePerPerson: Number(pricePerPerson),
      estimatedTotal: estimatedTotal !== undefined ? Number(estimatedTotal) : undefined,
      occasion,
      specialRequests,
      userId: req.user?.role === 'user' ? req.user.id : undefined,
    });
    sendSuccess(res, enquiry, 201, 'Day outing enquiry created');
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? Math.max(1, parseInt(String(req.query.page))) : 1;
    const limit = req.query.limit ? Math.max(1, Math.min(100, parseInt(String(req.query.limit)))) : 50;
    const result = await dayOutingService.listDayOutingEnquiries({
      role: req.user?.role,
      hostId: getHostScopeId(req),
      status: req.query.status ? String(req.query.status) : undefined,
      page,
      limit,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!status) return sendError(res, 'Status required', 400);
    const enquiry = await dayOutingService.updateDayOutingStatus(req.params.id, status, {
      role: req.user?.role,
      hostId: getHostScopeId(req),
    });
    sendSuccess(res, enquiry, 200, 'Day outing enquiry updated');
  } catch (err) {
    next(err);
  }
};
