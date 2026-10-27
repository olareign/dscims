import { Module } from '@nestjs/common';
import { SellersModule } from './sellers/sellers.module.js';

@Module({ imports: [SellersModule] })
export class PartiesModule {}
