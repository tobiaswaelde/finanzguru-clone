import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { DB, type FinanceDatabase } from '../../src/database/drizzle.module.js';

it('reports database readiness and documents the wire response', async () => {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  try {
    await configureApp(app, { docs: true, sessionSecret: 'synthetic-health-test-only', secure: false });
    await app.init();
    const response = await app.inject({ url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', db: 'ok' });
    const docs = await app.inject({ url: '/api/docs-json' });
    expect(docs.statusCode).toBe(200);
    expect(docs.json().paths).toHaveProperty('/api/health');
    const db = app.get<FinanceDatabase>(DB);
    const spy = vi.spyOn(db, 'get').mockImplementation(() => {
      throw new Error('internal detail');
    });
    try {
      const failure = await app.inject({ url: '/api/health' });
      expect(failure.statusCode).toBe(503);
      expect(failure.json()).toEqual({ statusCode: 503, statusMessage: 'Service Unavailable' });
    } finally {
      spy.mockRestore();
    }
  } finally {
    await app.close();
  }
});
