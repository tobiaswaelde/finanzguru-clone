import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { DB, type FinanceDatabase } from '../../src/database/drizzle.module.js';
import { owner } from '../../src/database/schema.js';
import { hashPassword } from '../../src/modules/auth/password.js';

it('validates login, creates a sealed session, and rate limits attempts', async () => {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  try {
    await configureApp(app, { docs: false, sessionSecret: 'synthetic-session-secret-for-tests', secure: true });
    await app.init();
    const db = app.get<FinanceDatabase>(DB);
    migrate(db, { migrationsFolder: join(__dirname, '../../src/database/migrations') });
    const password = 'synthetic-test-password';
    db.insert(owner)
      .values({ displayName: 'Demo', createdAt: new Date().toISOString(), passwordHash: await hashPassword(password) })
      .run();
    expect((await app.inject({ url: '/api/auth/session' })).statusCode).toBe(401);
    const invalid = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 123 } });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().data.issues).toEqual([{ path: ['password'], code: 'invalid_type' }]);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password } });
    expect(login.statusCode).toBe(204);
    const [cookie] = login.cookies;
    expect(cookie).toMatchObject({ name: 'finance_session', httpOnly: true, sameSite: 'Lax', secure: true });
    const cookies = { finance_session: cookie?.value ?? '' };
    expect((await app.inject({ url: '/api/auth/session', cookies })).json()).toEqual({ displayName: 'Demo' });
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', cookies });
    expect(logout.statusCode).toBe(204);
    expect(logout.cookies[0]).toMatchObject({ name: 'finance_session', value: '' });
    for (let attempt = 0; attempt < 3; attempt++) {
      const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'wrong' } });
      expect(wrong.statusCode).toBe(401);
    }
    const blocked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password } });
    expect(blocked.statusCode).toBe(429);
    expect((await app.inject({ url: '/api/docs-json' })).statusCode).toBe(404);
  } finally {
    await app.close();
  }
});
