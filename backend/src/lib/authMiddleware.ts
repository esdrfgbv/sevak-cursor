import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errors.js';
import type { JwtRole } from './jwt.js';
import { verifyAccessToken } from './jwt.js';

export type AuthedRequest = Request & {
  auth?: {
    userId: string;
    role: JwtRole;
  };
};

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return next(new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Missing bearer token' }));

  try {
    const payload = verifyAccessToken(m[1]!);
    if (payload.type !== 'access') {
      return next(new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Invalid token type' }));
    }
    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Invalid or expired token' }));
  }
}

export function requireRole(roles: JwtRole[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Not logged in' }));
    if (!roles.includes(req.auth.role)) {
      return next(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Insufficient role' }));
    }
    next();
  };
}

