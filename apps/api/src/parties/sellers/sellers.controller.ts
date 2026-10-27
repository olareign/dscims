import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { sellerInput, sellerListQuery } from '@dscims/shared';
import type { SellerInput, SellerListQuery } from '@dscims/shared';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { Can, CurrentUser, Meta } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { SellersService } from './sellers.service.js';

// Sellers hold IDs and NIN/BVN, so only the people who can record purchases may see them.
@Can('purchase.record')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  list(@CurrentUser() user: Principal, @Query(new ZodPipe(sellerListQuery)) q: SellerListQuery) {
    return this.sellers.list(user.tenantId, q);
  }

  @Get(':id')
  get(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.get(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: Principal, @Body(new ZodPipe(sellerInput)) body: SellerInput, @Meta() meta: ReqMeta) {
    return this.sellers.create(user, body, meta);
  }
}
