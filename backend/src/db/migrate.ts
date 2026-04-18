import 'dotenv/config';

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { logger } from '../lib/logger.js';

async function main() {
  await migrate(db, { migrationsFolder: 'src/db/migrations' });
  logger.info('migrations applied');
  await pool.end();
}

main().catch(async (err) => {
  logger.error({ err }, 'migration failed');
  await pool.end();
  process.exit(1);
});

