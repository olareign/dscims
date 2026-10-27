import { Module } from '@nestjs/common';
import { PurchasesModule } from './purchases/purchases.module.js';
import { SalesModule } from './sales/sales.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { CreditModule } from './credit/credit.module.js';
import { ReturnsModule } from './returns/returns.module.js';

@Module({
  imports: [PurchasesModule, SalesModule, PaymentsModule, CreditModule, ReturnsModule]
})
export class TransactionsModule {}
