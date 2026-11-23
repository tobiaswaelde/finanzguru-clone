import { createHash } from 'node:crypto';
import secureSession from '@fastify/secure-session';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

/** Apply transport configuration shared by the production entry point and integration tests. */
export async function configureApp(
  app: NestFastifyApplication,
  { docs, sessionSecret, secure }: { docs: boolean; sessionSecret: string; secure: boolean },
): Promise<void> {
  await app.register(secureSession, {
    key: createHash('sha256').update(sessionSecret).digest(),
    cookieName: 'finance_session',
    expiry: 86400,
    cookie: { path: '/', sameSite: 'lax', httpOnly: true, secure, maxAge: 86400 },
  });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  if (docs) {
    const config = new DocumentBuilder().setTitle('Finance API').setVersion('1.0').build();
    SwaggerModule.setup('api/docs', app, () => cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)));
  }
}
