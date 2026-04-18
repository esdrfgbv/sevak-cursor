import jwt from 'jsonwebtoken';
import { env } from './env.js';

export type JwtRole = 'admin' | 'coordinator' | 'volunteer';
export type AccessTokenPayload = {
  sub: string;
  role: JwtRole;
  type: 'access';
};
export type RefreshTokenPayload = {
  sub: string;
  role: JwtRole;
  type: 'refresh';
};

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>) {
  return jwt.sign({ ...payload, type: 'access' } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>) {
  return jwt.sign({ ...payload, type: 'refresh' } satisfies RefreshTokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

