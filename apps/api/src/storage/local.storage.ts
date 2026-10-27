import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Response } from 'express';
import { FileStorage, type StoredFile, type UploadRequest } from './file-storage.js';

/** Development and tests only: keeps files in a folder on this machine. Production uses Cloudinary. */
export class LocalStorage extends FileStorage {
  readonly driver = 'local' as const;
  private readonly root: string;

  constructor(directory: string) {
    super();
    this.root = resolve(directory);
  }

  /** Never lets a key point outside the storage folder. */
  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) throw new Error('Invalid storage key.');
    return full;
  }

  async upload(request: UploadRequest): Promise<StoredFile> {
    const key = join(request.folder, `${request.name || randomUUID()}.${request.extension}`);
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, request.buffer);
    return { key, resourceType: null, format: null, bytes: request.buffer.length };
  }

  async deliver(file: { key: string; filename: string; mime: string; inline?: boolean }, response: Response): Promise<void> {
    response.set({
      'Content-Type': file.mime,
      'Content-Disposition': `${file.inline ? 'inline' : 'attachment'}; filename="${file.filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    await new Promise<void>((resolveStream, reject) => {
      const stream = createReadStream(this.pathFor(file.key));
      stream.on('error', reject);
      stream.on('end', resolveStream);
      stream.pipe(response);
    });
  }

  async remove(file: { key: string }): Promise<void> {
    await rm(this.pathFor(file.key), { force: true });
  }
}
