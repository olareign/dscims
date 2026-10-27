import { ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { Response } from 'express';
import { FileStorage, type StoredFile, type UploadRequest } from './file-storage.js';

/** How long a download link works. It is made fresh for every click, so it only has to outlive the redirect. */
const LINK_SECONDS = 120;

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Files go to Cloudinary as `authenticated` assets: they have no public URL at all. Downloads are served by
 * redirecting to a signed, expiring link made for that one request, after our own access checks have passed.
 */
export class CloudinaryStorage extends FileStorage {
  readonly driver = 'cloudinary' as const;

  constructor(private readonly credentials: CloudinaryCredentials) {
    super();
    cloudinary.config({ cloud_name: credentials.cloudName, api_key: credentials.apiKey, api_secret: credentials.apiSecret, secure: true });
  }

  upload(request: UploadRequest): Promise<StoredFile> {
    const isImage = request.mime.startsWith('image/');
    // Non-image files are stored raw, and a raw asset's public id carries its extension.
    const publicId = `dscims/${request.folder}/${request.name}${isImage ? '' : `.${request.extension}`}`;
    return new Promise<StoredFile>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: isImage ? 'image' : 'raw', type: 'authenticated', overwrite: false, unique_filename: false },
        (error, result) => {
          if (error || !result) return reject(new ServiceUnavailableException(`File storage refused the upload${error?.message ? `: ${error.message}` : '.'}`));
          resolve({ key: result.public_id, resourceType: result.resource_type, format: isImage ? (result.format ?? request.extension) : null, bytes: result.bytes });
        },
      );
      stream.end(request.buffer);
    });
  }

  /** The signed, expiring link for one download. Exposed for tests. */
  downloadUrl(file: { key: string; resourceType: string | null; format: string | null }): string {
    return cloudinary.utils.private_download_url(file.key, file.format ?? '', {
      resource_type: file.resourceType ?? 'raw',
      type: 'authenticated',
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + LINK_SECONDS,
    });
  }

  async deliver(file: { key: string; resourceType: string | null; format: string | null; inline?: boolean }, response: Response): Promise<void> {
    response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    response.redirect(302, this.downloadUrl(file));
  }

  async remove(file: { key: string; resourceType: string | null }): Promise<void> {
    await cloudinary.uploader.destroy(file.key, { resource_type: file.resourceType ?? 'raw', type: 'authenticated', invalidate: true });
  }
}
