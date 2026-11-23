import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PUBLIC_ROUTE } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import './session.types.js';

/** Require a valid owner session unless an endpoint is explicitly public. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  /** Reject absent, invalid, or removed owner sessions. */
  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]))
      return true;
    const id = context.switchToHttp().getRequest<FastifyRequest>().session.get('ownerId');
    if (!id || !this.auth.getProfile(id)) throw new UnauthorizedException();
    return true;
  }
}
