import { STATUS_CODES } from 'node:http';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';

/** Map Nest errors to the transport contract without exposing internal errors or inputs. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /** Serialize an error with a stable HTTP status and optional validation issues. */
  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    if (!(exception instanceof HttpException)) this.logger.error('Unexpected API error');
    const statusMessage = STATUS_CODES[statusCode] ?? 'Request failed';
    if (exception instanceof ZodValidationException) {
      const issues = (exception.getZodError() as { issues: { path: PropertyKey[]; code: string }[] }).issues.map(
        ({ path, code }) => ({ path: path.map(String), code }),
      );
      void reply.status(statusCode).send({ statusCode, statusMessage, data: { issues } });
      return;
    }
    void reply.status(statusCode).send({ statusCode, statusMessage });
  }
}
