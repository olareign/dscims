import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { inviteUserInput, updateUserInput, userListQuery } from '@dscims/shared';
import type { InviteUserInput, UpdateUserInput, UserListQuery } from '@dscims/shared';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { Can, CurrentUser, Meta } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { UsersService } from './users.service.js';

@Can('users.manage')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: Principal, @Query(new ZodPipe(userListQuery)) q: UserListQuery) {
    return this.users.list(user.tenantId, q);
  }

  @Get('counts')
  counts(@CurrentUser() user: Principal) {
    return this.users.counts(user.tenantId);
  }

  @Get(':id')
  get(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(user.tenantId, id);
  }

  @Post()
  invite(@CurrentUser() user: Principal, @Body(new ZodPipe(inviteUserInput)) body: InviteUserInput, @Meta() meta: ReqMeta) {
    return this.users.invite(user, body, meta);
  }

  @Post(':id/resend-invite') @HttpCode(200)
  resend(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Meta() meta: ReqMeta) {
    return this.users.resendInvite(user, id, meta);
  }

  @Patch(':id')
  update(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateUserInput)) body: UpdateUserInput, @Meta() meta: ReqMeta) {
    return this.users.update(user, id, body, meta);
  }

  @Post(':id/deactivate') @HttpCode(200)
  deactivate(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Meta() meta: ReqMeta) {
    return this.users.deactivate(user, id, meta);
  }

  @Post(':id/reactivate') @HttpCode(200)
  reactivate(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Meta() meta: ReqMeta) {
    return this.users.reactivate(user, id, meta);
  }
}
