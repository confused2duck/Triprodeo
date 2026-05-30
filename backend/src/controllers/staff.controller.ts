import { Request, Response, NextFunction } from 'express';
import * as staffService from '../services/staff.service';
import { sendSuccess, sendError } from '../utils/response.util';

const getHostScopeId = (req: Request) => req.user?.hostId ?? req.user!.id;

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = typeof req.query.propertyId === 'string' ? req.query.propertyId : undefined;
    const staff = await staffService.listStaff(getHostScopeId(req), propertyId);
    sendSuccess(res, staff);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, name, role } = req.body;
    if (!propertyId || !name || !role) {
      return sendError(res, 'propertyId, name and role are required', 400);
    }
    const staff = await staffService.createStaff(getHostScopeId(req), req.body);
    sendSuccess(res, staff, 201, 'Staff created');
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const staff = await staffService.updateStaff(getHostScopeId(req), req.params.id, req.body);
    sendSuccess(res, staff, 200, 'Staff updated');
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await staffService.deleteStaff(getHostScopeId(req), req.params.id);
    sendSuccess(res, null, 200, 'Staff deleted');
  } catch (err) {
    next(err);
  }
};
