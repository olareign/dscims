import { Module } from '@nestjs/common';
import { FieldCrypto } from '../../common/field-crypto.js';
import { SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';

@Module({ controllers: [SellersController], providers: [SellersService, FieldCrypto], exports: [SellersService] })
export class SellersModule {}
