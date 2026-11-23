import { Body, Controller, Get, HttpCode, Inject, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import './session.types.js';

/** Login input accepted from the owner. */
class LoginDto extends createZodDto(z.object({ password: z.string().min(1).max(1024) })) {}

/** Handles login and the current browser session. */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** Authenticate and issue the sealed cookie. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(204)
  async login(@Body() body: LoginDto, @Req() request: FastifyRequest): Promise<void> {
    const id = await this.auth.login(body.password);
    request.session.regenerate();
    request.session.set('ownerId', id);
  }

  /** Clear the current browser's session cookie. */
  @Post('logout')
  @HttpCode(204)
  logout(@Req() request: FastifyRequest): void {
    request.session.delete();
  }

  /** Return the current owner's display name. */
  @Get('session')
  session(@Req() request: FastifyRequest): { displayName: string } {
    const id = request.session.get('ownerId');
    const profile = id ? this.auth.getProfile(id) : undefined;
    if (!profile) throw new UnauthorizedException();
    return profile;
  }
}
