import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { acceptInviteInput, changePasswordInput, forgotPasswordInput, loginInput, resetPasswordInput } from '@dscims/shared';
import type { z } from 'zod';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { CurrentUser, Meta, Public } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AuthService } from './auth.service.js';

const STRICT = { default: { limit: 10, ttl: 60000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Throttle(STRICT) @Post('login') @HttpCode(200)
  login(@Body(new ZodPipe(loginInput)) body: z.infer<typeof loginInput>, @Meta() meta: ReqMeta) {
    return this.auth.login(body.email, body.password, meta);
  }

  @Post('logout') @HttpCode(204)
  async logout(@CurrentUser() user: Principal, @Meta() meta: ReqMeta) {
    await this.auth.logout(user, meta);
  }

  @Get('me')
  me(@CurrentUser() user: Principal) {
    return this.auth.me(user);
  }

  @Public() @Throttle(STRICT) @Post('forgot-password') @HttpCode(202)
  async forgot(@Body(new ZodPipe(forgotPasswordInput)) body: z.infer<typeof forgotPasswordInput>, @Meta() meta: ReqMeta) {
    await this.auth.forgotPassword(body.email, meta);
    return { ok: true };
  }

  @Public() @Throttle(STRICT) @Post('reset-password') @HttpCode(204)
  async reset(@Body(new ZodPipe(resetPasswordInput)) body: z.infer<typeof resetPasswordInput>, @Meta() meta: ReqMeta) {
    await this.auth.resetPassword(body.token, body.password, meta);
  }

  @Public() @Throttle(STRICT) @Get('invite/:token')
  inviteInfo(@Param('token') token: string) {
    return this.auth.inviteInfo(token);
  }

  @Public() @Throttle(STRICT) @Post('accept-invite') @HttpCode(200)
  accept(@Body(new ZodPipe(acceptInviteInput)) body: z.infer<typeof acceptInviteInput>, @Meta() meta: ReqMeta) {
    return this.auth.acceptInvite(body.token, body.password, meta);
  }

  @Throttle(STRICT) @Post('change-password') @HttpCode(204)
  async change(@CurrentUser() user: Principal, @Body(new ZodPipe(changePasswordInput)) body: z.infer<typeof changePasswordInput>, @Meta() meta: ReqMeta) {
    await this.auth.changePassword(user, body.currentPassword, body.password, meta);
  }
}
