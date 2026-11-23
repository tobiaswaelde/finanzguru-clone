import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { parseApiEnv } from './config/env.schema.js';

/** Validate configuration before starting the same-origin API's backend process. */
async function bootstrap(): Promise<void> {
  loadLocalEnv();
  const env = parseApiEnv(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { bufferLogs: true });
  configureApp(app, process.env.NODE_ENV !== 'production');
  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
}

/** Load optional local configuration while preserving process environment overrides. */
function loadLocalEnv(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
}

void bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'API startup failed');
  process.exitCode = 1;
});
