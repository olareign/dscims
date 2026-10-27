import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { purchaseInput } from '@dscims/shared';
import type { PurchaseInput } from '@dscims/shared';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { Can, CurrentUser, Meta } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { purchaseReceiptPdf } from './purchase-receipt.js';
import { PurchasesService } from './purchases.service.js';

@Can('purchase.record')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  // Retrying with the same Idempotency-Key returns the first purchase instead of buying twice (PWA-4).
  @Post()
  create(@CurrentUser() user: Principal, @Body(new ZodPipe(purchaseInput)) body: PurchaseInput, @Meta() meta: ReqMeta) {
    return this.purchases.create(user, body, meta);
  }

  @Get(':id')
  get(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchases.get(user.tenantId, id);
  }

  @Get(':id/receipt')
  async receipt(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const purchase = await this.purchases.get(user.tenantId, id);
    const pdf = await purchaseReceiptPdf(purchase, await this.purchases.businessName(user.tenantId));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${purchase.number}.pdf"`, 'Cache-Control': 'no-store' }).send(pdf);
  }
}
