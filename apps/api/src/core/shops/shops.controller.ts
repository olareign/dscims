import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { geocodeQuery, shopInput, shopListQuery } from '@dscims/shared';
import type { ShopInput, ShopListQuery } from '@dscims/shared';
import type { z } from 'zod';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { Can, CurrentUser, Meta } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { ShopsService } from './shops.service.js';

@Can('shops.manage')
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  list(@CurrentUser() user: Principal, @Query(new ZodPipe(shopListQuery)) q: ShopListQuery) {
    return this.shops.list(user.tenantId, q);
  }

  // Declared before :id so "address-lookup" is not read as an id.
  @Throttle({ default: { limit: 20, ttl: 60000 } }) @Get('address-lookup')
  lookup(@Query(new ZodPipe(geocodeQuery)) q: z.infer<typeof geocodeQuery>) {
    return this.shops.addressFor(q.lat, q.lng);
  }

  @Get(':id')
  get(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.shops.get(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: Principal, @Body(new ZodPipe(shopInput)) body: ShopInput, @Meta() meta: ReqMeta) {
    return this.shops.create(user, body, meta);
  }

  @Patch(':id')
  update(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(shopInput)) body: ShopInput, @Meta() meta: ReqMeta) {
    return this.shops.update(user, id, body, meta);
  }
}
