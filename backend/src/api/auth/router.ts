import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { ApiError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { db } from '../../db/client.js';
import { users, volunteers } from '../../db/schema.js';
import { writeAuditLog } from '../../lib/audit.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: z.enum(['coordinator', 'volunteer', 'admin']).default('volunteer'),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);

    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (existing) throw new ApiError({ status: 409, code: 'EMAIL_TAKEN', message: 'Email already registered' });

    const [user] = await db
      .insert(users)
      .values({ email: body.email, passwordHash, phone: body.phone, role: body.role })
      .returning();

    if (!user) throw new ApiError({ status: 500, code: 'CREATE_FAILED', message: 'Failed to create user' });

    if (body.role === 'volunteer') {
      const firstName = body.first_name ?? 'Volunteer';
      const lastName = body.last_name ?? 'User';
      await db.insert(volunteers).values({ userId: user.id, firstName, lastName, phone: body.phone });
    }

    await writeAuditLog({ actorId: user.id, action: 'auth.register', resourceType: 'user', resourceId: user.id });

    const access_token = signAccessToken({ sub: user.id, role: user.role });
    const refresh_token = signRefreshToken({ sub: user.id, role: user.role });

    res.json({
      access_token,
      refresh_token,
      user: { id: user.id, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (!user) throw new ApiError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) throw new ApiError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });

    await writeAuditLog({ actorId: user.id, action: 'auth.login', resourceType: 'user', resourceId: user.id });

    res.json({
      access_token: signAccessToken({ sub: user.id, role: user.role }),
      refresh_token: signRefreshToken({ sub: user.id, role: user.role }),
      user: { id: user.id, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    const payload = verifyRefreshToken(body.refresh_token);
    if (payload.type !== 'refresh') {
      throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Invalid token type' });
    }
    res.json({ access_token: signAccessToken({ sub: payload.sub, role: payload.role }) });
  } catch (err) {
    next(new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Invalid refresh token' }));
  }
});

