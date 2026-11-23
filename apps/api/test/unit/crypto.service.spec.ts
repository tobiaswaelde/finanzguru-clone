import { afterEach, expect, it, vi } from 'vitest';
import { CryptoService } from '../../src/common/crypto.service.js';

afterEach(vi.unstubAllEnvs);

it('round trips grants using independent IVs', () => {
  vi.stubEnv('API_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'));
  const service = new CryptoService();
  const plaintext = 'test grant 🧪';
  const encrypted = service.encrypt(plaintext);
  expect(encrypted.subarray(0, 12)).not.toEqual(service.encrypt(plaintext).subarray(0, 12));
  expect(service.decrypt(encrypted)).toBe(plaintext);
});

it('rejects corrupted, truncated, and wrong-key grants without revealing their content', () => {
  vi.stubEnv('API_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'));
  const service = new CryptoService();
  const encrypted = service.encrypt('test');
  expect(() => service.decrypt(encrypted.subarray(0, 12))).toThrow('Invalid encrypted grant');
  const tampered = Buffer.from(encrypted);
  tampered.writeUInt8(tampered.readUInt8(12) ^ 1, 12);
  expect(() => service.decrypt(tampered)).toThrow('Invalid encrypted grant');
  vi.stubEnv('API_ENCRYPTION_KEY', Buffer.alloc(32, 2).toString('base64'));
  expect(() => new CryptoService().decrypt(encrypted)).toThrow('Invalid encrypted grant');
});
