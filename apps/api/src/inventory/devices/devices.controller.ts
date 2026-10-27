import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { addPhotoInput, deviceListQuery, deviceUpdateInput, flagInput, imeiCheckQuery, resolveFlagInput } from '@dscims/shared';
import type { DeviceListQuery, DeviceUpdateInput, FlagInput, ResolveFlagInput } from '@dscims/shared';
import { z } from 'zod';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { Can, CurrentUser, Meta } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { DevicesService } from './devices.service.js';

const countsQuery = z.object({ shopId: z.string().uuid().optional() });
const uuid = new ParseUUIDPipe();

@Can('inventory.view')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@CurrentUser() user: Principal, @Query(new ZodPipe(deviceListQuery)) q: DeviceListQuery) {
    return this.devices.list(user, q);
  }

  @Get('counts')
  counts(@CurrentUser() user: Principal, @Query(new ZodPipe(countsQuery)) q: z.infer<typeof countsQuery>) {
    return this.devices.counts(user, q.shopId);
  }

  // The purchase form calls this while the IMEI is typed. Only the people who can buy phones need it.
  @Can('purchase.record') @Get('imei-check')
  imei(@CurrentUser() user: Principal, @Query(new ZodPipe(imeiCheckQuery)) q: z.infer<typeof imeiCheckQuery>) {
    return this.devices.imeiCheck(user.tenantId, q.imei);
  }

  @Get(':id')
  get(@CurrentUser() user: Principal, @Param('id', uuid) id: string) {
    return this.devices.get(user, id);
  }

  @Can('device.write') @Patch(':id')
  update(@CurrentUser() user: Principal, @Param('id', uuid) id: string, @Body(new ZodPipe(deviceUpdateInput)) body: DeviceUpdateInput, @Meta() meta: ReqMeta) {
    return this.devices.update(user, id, body, meta);
  }

  @Can('device.write') @Post(':id/photos')
  addPhoto(@CurrentUser() user: Principal, @Param('id', uuid) id: string, @Body(new ZodPipe(addPhotoInput)) body: z.infer<typeof addPhotoInput>, @Meta() meta: ReqMeta) {
    return this.devices.addPhoto(user, id, body.fileId, meta);
  }

  @Can('flag.raise') @Post(':id/flag') @HttpCode(200)
  flag(@CurrentUser() user: Principal, @Param('id', uuid) id: string, @Body(new ZodPipe(flagInput)) body: FlagInput, @Meta() meta: ReqMeta) {
    return this.devices.flag(user, id, body, meta);
  }

  @Can('flag.resolve') @Post(':id/resolve-flag') @HttpCode(200)
  resolve(@CurrentUser() user: Principal, @Param('id', uuid) id: string, @Body(new ZodPipe(resolveFlagInput)) body: ResolveFlagInput, @Meta() meta: ReqMeta) {
    return this.devices.resolveFlag(user, id, body, meta);
  }

  @Can('proof.approve') @Post(':id/approve-proof') @HttpCode(200)
  approve(@CurrentUser() user: Principal, @Param('id', uuid) id: string, @Meta() meta: ReqMeta) {
    return this.devices.approveProof(user, id, meta);
  }
}
