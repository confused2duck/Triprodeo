import { Request, Response, NextFunction } from 'express';
import * as inventoryService from '../services/inventory.service';
import { sendError, sendSuccess } from '../utils/response.util';

export const calendar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId, propertyId, startDate, endDate } = req.query;
    if ((!roomId && !propertyId) || !startDate || !endDate) {
      return sendError(res, 'roomId or propertyId plus startDate and endDate are required', 400);
    }

    const checkIn = inventoryService.parseStayDate(startDate as string, 'startDate');
    const checkOut = inventoryService.parseStayDate(endDate as string, 'endDate');

    const calendar = roomId
      ? await inventoryService.getCalendarAvailability(roomId as string, checkIn, checkOut)
      : await inventoryService.getPropertyCalendarAvailability(propertyId as string, checkIn, checkOut);
    sendSuccess(res, calendar);
  } catch (err) {
    next(err);
  }
};

export const availability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId, propertyId, startDate, endDate } = req.query;
    if ((!roomId && !propertyId) || !startDate || !endDate) {
      return sendError(res, 'roomId or propertyId plus startDate and endDate are required', 400);
    }

    const checkIn = inventoryService.parseStayDate(startDate as string, 'startDate');
    const checkOut = inventoryService.parseStayDate(endDate as string, 'endDate');
    const summary = await inventoryService.getAvailabilitySummary({
      roomId: typeof roomId === 'string' ? roomId : undefined,
      propertyId: typeof propertyId === 'string' ? propertyId : undefined,
      checkIn,
      checkOut,
    });

    const payload: Record<string, unknown> = {
      availableRooms: summary.availableRooms,
      bookedRooms: summary.bookedRooms,
      totalRooms: summary.totalRooms,
      isAvailable: summary.isAvailable,
    };

    if ('roomId' in summary && typeof summary.roomId === 'string') {
      payload.roomId = summary.roomId;
    }
    if ('propertyId' in summary && typeof summary.propertyId === 'string') {
      payload.propertyId = summary.propertyId;
    }

    sendSuccess(res, payload);
  } catch (err) {
    next(err);
  }
};
