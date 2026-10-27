import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { settingsInput } from '@dscims/shared';
import type { SettingsInput } from '@dscims/shared';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { Can, CurrentUser, Meta } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { DashboardService } from './dashboard.service.js';
import { SettingsService } from './settings.service.js';

@Controller()
export class TenantsController {
  constructor(private readonly settings: SettingsService, private readonly dashboard: DashboardService) {}

  @Get('settings')
  getSettings(@CurrentUser() user: Principal) {
    return this.settings.get(user.tenantId);
  }

  @Can('settings.manage') @Put('settings')
  update(@CurrentUser() user: Principal, @Body(new ZodPipe(settingsInput)) body: SettingsInput, @Meta() meta: ReqMeta) {
    return this.settings.update(user, body, meta);
  }

  @Can('settings.manage') @Post('settings/complete-setup') @HttpCode(204)
  async complete(@CurrentUser() user: Principal, @Meta() meta: ReqMeta) {
    await this.settings.completeSetup(user, meta);
  }

  @Can('users.manage') @Get('dashboard/overview')
  overview(@CurrentUser() user: Principal) {
    return this.dashboard.overview(user.tenantId);
  }
}
