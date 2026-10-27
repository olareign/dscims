import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { SettingsService } from './settings.service.js';
import { TenantsController } from './tenants.controller.js';

@Module({ controllers: [TenantsController], providers: [SettingsService, DashboardService] })
export class TenantsModule {}
