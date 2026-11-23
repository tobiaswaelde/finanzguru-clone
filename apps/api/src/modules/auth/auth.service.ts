import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { owner } from '../../database/schema.js';
import { verifyPassword } from './password.js';

const fallbackHash = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;

/** Verifies credentials and looks up the single owner. */
@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Authenticate the requested password, returning the owner ID on success. */
  async login(password: string): Promise<string> {
    const record = this.db.select({ id: owner.id, passwordHash: owner.passwordHash }).from(owner).get();
    if (!(await verifyPassword(password, record?.passwordHash ?? fallbackHash)) || !record) {
      throw new UnauthorizedException();
    }
    return record.id;
  }

  /** Read only the owner's public session profile. */
  getProfile(id: string): { displayName: string } | undefined {
    return this.db.select({ displayName: owner.displayName }).from(owner).where(eq(owner.id, id)).get();
  }
}
