import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';

import { corsOrigins, env } from './lib/env.js';
import { errorMiddleware, notFound } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { authRouter } from './api/auth/router.js';
import { volunteersRouter } from './api/volunteers/router.js';
import { tasksRouter } from './api/tasks/router.js';
import { assignmentsRouter } from './api/assignments/router.js';
import { analyticsRouter } from './api/analytics/router.js';
import { initSocket } from './realtime/socket.js';

export function buildApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/volunteers', volunteersRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/analytics', analyticsRouter);

  app.use(notFound);
  app.use(errorMiddleware);
  return app;
}

const app = buildApp();
const server = createServer(app);
initSocket(server);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'backend listening');
});

