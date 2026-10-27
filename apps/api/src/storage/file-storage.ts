import type { Response } from 'express';

export interface StoredFile {
  /** Where the driver keeps it: a Cloudinary public id, or a path under the local folder. */
  key: string;
  /** Cloudinary's notion of what it stored; null for the local driver. */
  resourceType: string | null;
  format: string | null;
  bytes: number;
}

export interface UploadRequest {
  buffer: Buffer;
  /** A folder-like prefix, e.g. `businessId/project`. */
  folder: string;
  /** Stored name without a folder, unique per file. */
  name: string;
  extension: string;
  mime: string;
}

/** Where uploaded files live. Two drivers: Cloudinary (the real one) and a local folder for development. */
export abstract class FileStorage {
  abstract readonly driver: 'cloudinary' | 'local';
  abstract upload(request: UploadRequest): Promise<StoredFile>;
  /** Sends the file to the person downloading it: a short-lived signed redirect, or the bytes themselves. */
  /** `inline` shows it in the browser (or lets a network fetch it) instead of offering it as a download. */
  abstract deliver(file: { key: string; resourceType: string | null; format: string | null; filename: string; mime: string; inline?: boolean }, response: Response): Promise<void>;
  abstract remove(file: { key: string; resourceType: string | null }): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
