import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { auditListQuery } from '@dscims/shared';
import type { AuditListQuery } from '@dscims/shared';
import type { Principal } from '../../common/auth.types.js';
import { Can, CurrentUser } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AuditQueryService } from './audit-query.service.js';

@Can('audit.view')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  list(@CurrentUser() user: Principal, @Query(new ZodPipe(auditListQuery)) q: AuditListQuery) {
    return this.audit.list(user.tenantId, q);
  }

  @Get('counts')
  counts(@CurrentUser() user: Principal) {
    return this.audit.counts(user.tenantId);
  }

  @Get(':id')
  get(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.audit.get(user.tenantId, id);
  }
}
