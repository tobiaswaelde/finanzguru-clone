import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);

/** Derive a salted scrypt password hash for the single owner. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** Compare the supplied password with a stored hash using constant-time byte comparison. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt, hash] = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/u.exec(stored) ?? [];
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = (await derive(password, Buffer.from(salt, 'hex'), expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}
