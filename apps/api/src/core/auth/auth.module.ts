import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/app-config.js';
import { AuditModule } from '../audit/audit.module.js';
import { MailModule } from '../mail/mail.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard, CapabilityGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  imports: [
    AuditModule,
    MailModule,
    JwtModule.registerAsync({ inject: [AppConfig], useFactory: ({ env }: AppConfig) => ({ secret: env.JWT_SECRET }) }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, CapabilityGuard],
  exports: [AuthService, AuthGuard, CapabilityGuard, JwtModule],
})
export class AuthModule {}
