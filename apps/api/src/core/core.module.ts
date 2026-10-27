import { Module } from '@nestjs/common';
import { TenantsModule } from './tenants/tenants.module.js';
import { ShopsModule } from './shops/shops.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';

@Module({
  imports: [TenantsModule, ShopsModule, UsersModule, AuthModule, AuditModule]
})
export class CoreModule {}
