import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { fileKindInput } from '@dscims/shared';
import type { Principal } from '../../common/auth.types.js';
import { Can, CurrentUser } from '../../common/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { FilesService, MAX_FILE_BYTES } from './files.service.js';

interface UploadedBytes { buffer: Buffer; originalname: string }

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Can('purchase.record') @Throttle({ default: { limit: 60, ttl: 60000 } }) @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES + 1, files: 1 } }))
  upload(@CurrentUser() user: Principal, @Body(new ZodPipe(fileKindInput)) body: { kind: 'seller_id' | 'device_photo' | 'proof' }, @UploadedFile() file: UploadedBytes | undefined) {
    return this.files.upload(user, body.kind, file);
  }

  // Access depends on the file's kind, so the service checks it (see FilesService.deliver).
  @Get(':id')
  download(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    return this.files.deliver(user, id, response);
  }
}
