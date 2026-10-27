import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { accessFor } from '@dscims/shared';
import type { FileDto } from '@dscims/shared';
import { AppError, forbidden, notFound } from '../../common/errors.js';
import { sha256 } from '../../common/crypto.js';
import type { Principal } from '../../common/auth.types.js';
import { StoredFileRow } from '../../core/entities.js';
import { TenantDb } from '../../database/tenant-db.js';
import { FILE_STORAGE, FileStorage } from '../../storage/file-storage.js';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // DOC-3: JPG, PNG or PDF up to 10 MB

type Kind = StoredFileRow['kind'];
type Detected = { mime: string; extension: string };

/** Trusts the file's own first bytes, not the name or the type the browser claims. */
export function detectFileType(buffer: Buffer): Detected | null {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', extension: 'png' };
  if (buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', extension: 'pdf' };
  return null;
}

const toDto = (f: StoredFileRow): FileDto => ({ id: f.id, kind: f.kind, filename: f.filename, mime: f.mime, bytes: f.bytes });

@Injectable()
export class FilesService {
  constructor(private readonly db: TenantDb, @Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  async upload(p: Principal, kind: Kind, file: { buffer: Buffer; originalname: string } | undefined): Promise<FileDto> {
    if (!file || file.buffer.length === 0) throw new AppError(HttpStatus.BAD_REQUEST, 'NO_FILE', 'Choose a photo or PDF to upload');
    if (file.buffer.length > MAX_FILE_BYTES) throw new AppError(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', 'That file is over 10 MB. Choose a smaller one');
    const type = detectFileType(file.buffer);
    if (!type) throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'FILE_TYPE', 'Upload a JPG, PNG or PDF file');
    if (kind === 'device_photo' && type.mime === 'application/pdf') throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'FILE_TYPE', 'Device photos must be JPG or PNG');
    const stored = await this.storage.upload({ buffer: file.buffer, folder: `${p.tenantId}/${kind}`, name: randomUUID(), extension: type.extension, mime: type.mime });
    const filename = (file.originalname || `file.${type.extension}`).replace(/[^\w.\- ]/g, '_').slice(-200);
    return this.db.run(p.tenantId, async (m) => {
      const row = await m.save(StoredFileRow, m.create(StoredFileRow, {
        tenantId: p.tenantId, createdBy: p.userId, kind, storageKey: stored.key, resourceType: stored.resourceType, format: stored.format,
        filename, mime: type.mime, bytes: stored.bytes, contentHash: sha256(file.buffer.toString('base64')),
      }));
      return toDto(row);
    });
  }

  async deliver(p: Principal, id: string, response: Response): Promise<void> {
    const file = await this.db.run(p.tenantId, (m) => m.findOneBy(StoredFileRow, { id }));
    if (!file) throw notFound('File');
    // Seller IDs and proof documents are for the people who can record purchases; device photos are for everyone who sees stock.
    if (file.kind !== 'device_photo' && accessFor(p.role, 'purchase.record') !== 'Y') throw forbidden();
    await this.storage.deliver({ key: file.storageKey, resourceType: file.resourceType, format: file.format, filename: file.filename, mime: file.mime, inline: true }, response);
  }
}
