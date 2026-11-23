import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';

it('initializes the Nest app with a Fastify adapter', async () => {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  try {
    app.setGlobalPrefix('api');
    await app.init();
    const response = await app.inject({ url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  } finally {
    await app.close();
  }
});
