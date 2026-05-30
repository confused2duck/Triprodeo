import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  id: string;
  email: string;
  role: 'admin' | 'host' | 'user' | 'staff';
  userType?: 'owner' | 'staff' | 'admin' | 'user';
  permissions?: string[];
  propertyId?: string;
  hostId?: string;
  staffId?: string;
}

// A payload coming back from jwt.verify() carries reserved claims (iat, exp,
// nbf, …). Re-signing those with an `expiresIn` option makes jsonwebtoken throw,
// which previously turned every token refresh into a 500. Strip them first.
const toSignablePayload = (payload: TokenPayload): TokenPayload => ({
  id: payload.id,
  email: payload.email,
  role: payload.role,
  ...(payload.userType !== undefined ? { userType: payload.userType } : {}),
  ...(payload.permissions !== undefined ? { permissions: payload.permissions } : {}),
  ...(payload.propertyId !== undefined ? { propertyId: payload.propertyId } : {}),
  ...(payload.hostId !== undefined ? { hostId: payload.hostId } : {}),
  ...(payload.staffId !== undefined ? { staffId: payload.staffId } : {}),
});

export const signAccessToken = (payload: TokenPayload): string =>
  jwt.sign(toSignablePayload(payload), env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

export const signRefreshToken = (payload: TokenPayload): string =>
  jwt.sign(toSignablePayload(payload), env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
};
