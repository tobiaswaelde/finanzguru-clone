import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { seedDemo } from '../../src/database/demo.js';
import { DB, type FinanceDatabase } from '../../src/database/drizzle.module.js';
import { owner } from '../../src/database/schema.js';
import { seedDefaults } from '../../src/database/seed.js';
import { hashPassword } from '../../src/modules/auth/password.js';

/** Start an owner-authenticated test app using only the API test suite's in-memory database. */
export async function ownerApp({ demo = false }: { demo?: boolean } = {}) {
  if (process.env.DATABASE_PATH !== ':memory:') throw new Error('Test app requires in-memory SQLite');
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  try {
    await configureApp(app, { docs: true, sessionSecret: 'synthetic-owner-test-configuration', secure: false });
    await app.init();
    const db = app.get<FinanceDatabase>(DB);
    migrate(db, { migrationsFolder: join(__dirname, '../../src/database/migrations') });
    seedDefaults(db);
    if (demo) seedDemo(db);
    const password = 'synthetic-tests-only';
    db.insert(owner)
      .values({ displayName: 'Demo', passwordHash: await hashPassword(password), createdAt: new Date().toISOString() })
      .run();
    const login = await app.inject({ url: '/api/auth/login', method: 'POST', payload: { password } });
    const cookie = login.cookies[0];
    if (login.statusCode !== 204 || !cookie) throw new Error('Test login failed');
    return { app, db, cookies: { finance_session: cookie.value } };
  } catch (error) {
    await app.close();
    throw error;
  }
}
