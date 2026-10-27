import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createDealerInput, dealerListQuery, loginInput } from '@dscims/shared';
import type { CreateDealerInput, DealerListQuery } from '@dscims/shared';
import type { z } from 'zod';
import type { PlatformPrincipal } from '../../common/auth.types.js';
import { CurrentAdmin, PlatformRoute, Public } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { PlatformService } from './platform.service.js';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Public() @Throttle({ default: { limit: 10, ttl: 60000 } }) @Post('auth/login') @HttpCode(200)
  login(@Body(new ZodPipe(loginInput)) body: z.infer<typeof loginInput>) {
    return this.platform.login(body.email, body.password);
  }

  @PlatformRoute() @Get('dealers')
  list(@Query(new ZodPipe(dealerListQuery)) q: DealerListQuery) {
    return this.platform.list(q);
  }

  @PlatformRoute() @Get('dealers/counts')
  counts() {
    return this.platform.counts();
  }

  @PlatformRoute() @Post('dealers')
  create(@CurrentAdmin() admin: PlatformPrincipal, @Body(new ZodPipe(createDealerInput)) body: CreateDealerInput) {
    return this.platform.create(admin, body);
  }

  @PlatformRoute() @Post('dealers/:id/suspend') @HttpCode(204)
  async suspend(@CurrentAdmin() admin: PlatformPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    await this.platform.suspend(admin, id);
  }

  @PlatformRoute() @Post('dealers/:id/reactivate') @HttpCode(204)
  async reactivate(@CurrentAdmin() admin: PlatformPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    await this.platform.reactivate(admin, id);
  }
}
