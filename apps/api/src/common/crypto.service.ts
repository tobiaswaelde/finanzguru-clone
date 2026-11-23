import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const ivBytes = 12;
const tagBytes = 16;

/** Protects connection grants at rest with AES-256-GCM. */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  /** Load the base64-encoded 32-byte application key. */
  constructor() {
    this.key = Buffer.from(process.env.API_ENCRYPTION_KEY ?? '', 'base64');
    if (this.key.length !== 32) throw new Error('Invalid API encryption key');
  }

  /** Encrypt UTF-8 text using a fresh IV; returns IV, tag and ciphertext in that order. */
  encrypt(plaintext: string): Buffer {
    const iv = randomBytes(ivBytes);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv, { authTagLength: tagBytes });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  }

  /** Decrypt a grant; throws when the payload is truncated or fails authentication. */
  decrypt(encrypted: Buffer): string {
    if (encrypted.length < ivBytes + tagBytes) throw new Error('Invalid encrypted grant');
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, encrypted.subarray(0, ivBytes), {
        authTagLength: tagBytes,
      });
      decipher.setAuthTag(encrypted.subarray(ivBytes, ivBytes + tagBytes));
      return Buffer.concat([decipher.update(encrypted.subarray(ivBytes + tagBytes)), decipher.final()]).toString(
        'utf8',
      );
    } catch {
      throw new Error('Invalid encrypted grant');
    }
  }
}
