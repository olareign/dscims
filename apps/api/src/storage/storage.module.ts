import { Global, Logger, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';
import type { Env } from '../config/app-config.js';
import { CloudinaryStorage } from './cloudinary.storage.js';
import { FILE_STORAGE, FileStorage } from './file-storage.js';
import { LocalStorage } from './local.storage.js';

/** `CLOUDINARY_URL` (cloudinary://key:secret@cloud-name) or the three separate settings. */
export function cloudinaryCredentials(env: Env) {
  const match = env.CLOUDINARY_URL ? /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(env.CLOUDINARY_URL.trim()) : null;
  if (match) return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = env;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [AppConfig],
      useFactory: ({ env }: AppConfig): FileStorage => {
        const credentials = cloudinaryCredentials(env);
        if (credentials) return new CloudinaryStorage(credentials);
        // The config check already refuses to start in production without Cloudinary.
        new Logger('Storage').warn('Cloudinary is not configured: keeping uploaded files in a local folder (development and tests only).');
        return new LocalStorage(env.LOCAL_STORAGE_DIR);
      },
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
