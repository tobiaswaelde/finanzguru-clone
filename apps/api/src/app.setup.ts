import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

/** Apply transport configuration shared by the production entry point and integration tests. */
export function configureApp(app: NestFastifyApplication, docs: boolean): void {
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  if (docs) {
    const config = new DocumentBuilder().setTitle('Finance API').setVersion('1.0').build();
    SwaggerModule.setup('api/docs', app, () => cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)));
  }
}
