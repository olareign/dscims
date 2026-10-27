import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';

// Development and tests only; production refuses to start without FIELD_ENCRYPTION_KEY.
const DEV_KEY = 'dscims-development-only-field-key-0123456789';

/** AES-256-GCM for NIN and BVN at rest. Output is `v1.iv.tag.ciphertext`, each part base64url. */
@Injectable()
export class FieldCrypto {
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    this.key = createHash('sha256').update(config.env.FIELD_ENCRYPTION_KEY ?? DEV_KEY).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, data] = stored.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable encrypted value');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }
}
