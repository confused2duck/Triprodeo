import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.util';
import { sendError } from '../utils/response.util';
import { hasPermission } from '../constants/permissions';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    sendError(res, 'Unauthorized', 401);
    return;
  }
  const token = header.split(' ')[1];
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    sendError(res, 'Token expired or invalid', 401);
  }
};

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.split(' ')[1];
  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Ignore invalid optional auth and continue as anonymous.
  }
  next();
};

export const requireRole =
  (...roles: TokenPayload['role'][]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      sendError(res, 'Forbidden', 403);
      return;
    }
    next();
  };

export const requirePermission =
  (...permissions: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Forbidden', 403);
      return;
    }

    if (req.user.role === 'admin') {
      next();
      return;
    }

    const allowed = permissions.some((permission) => hasPermission(req.user?.permissions, permission));
    if (!allowed) {
      sendError(res, 'Forbidden', 403);
      return;
    }
    next();
  };
