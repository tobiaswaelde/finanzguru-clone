import 'reflect-metadata';
import { join } from 'node:path';
import { dashboardLayoutSchema } from '@finance/shared';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { DB, type FinanceDatabase } from '../../src/database/drizzle.module.js';
import { owner } from '../../src/database/schema.js';
import { hashPassword } from '../../src/modules/auth/password.js';

it('guards layout and persists an atomic validated replacement', async () => {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  try {
    await configureApp(app, { docs: true, sessionSecret: 'synthetic-layout-test-only', secure: false });
    await app.init();
    const db = app.get<FinanceDatabase>(DB);
    migrate(db, { migrationsFolder: join(__dirname, '../../src/database/migrations') });
    const password = 'synthetic-layout-password';
    db.insert(owner)
      .values({ displayName: 'Demo', createdAt: new Date().toISOString(), passwordHash: await hashPassword(password) })
      .run();
    const url = '/api/dashboard/layout';
    expect((await app.inject({ url })).statusCode).toBe(401);
    const login = await app.inject({ url: '/api/auth/login', method: 'POST', payload: { password } });
    const cookies = { finance_session: login.cookies[0]?.value ?? '' };
    const initial = dashboardLayoutSchema.parse((await app.inject({ url, cookies })).json());
    const updated = initial.map((item) => ({ ...item, position: 7 - item.position, visible: item.position !== 0 }));
    const write = await app.inject({ url, method: 'PUT', cookies, payload: updated });
    expect(write.statusCode).toBe(200);
    expect(write.json()).toEqual([...updated].reverse());
    const bad = await app.inject({
      url,
      method: 'PUT',
      cookies,
      payload: updated.map((item) => ({ ...item, position: 0 })),
    });
    expect(bad.statusCode).toBe(400);
    expect((await app.inject({ url, cookies })).json()).toEqual([...updated].reverse());
    expect((await app.inject({ url: '/api/docs-json' })).json().paths[url].put.requestBody).toBeDefined();
  } finally {
    await app.close();
  }
});
