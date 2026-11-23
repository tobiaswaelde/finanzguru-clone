import { Controller, Get } from '@nestjs/common';

/** Exposes process liveness until the database health check is implemented. */
@Controller('health')
export class BootstrapHealthController {
  /** Reports that Nest accepted and routed the request. */
  @Get()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
