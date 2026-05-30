import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { sendError, sendSuccess } from '../utils/response.util';

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'user') {
      return sendError(res, 'Forbidden', 403);
    }

    const dashboard = await dashboardService.getUserDashboard(req.user.id);
    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
};
