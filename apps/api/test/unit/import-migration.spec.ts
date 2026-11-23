import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { csvMappingInputSchema, ruleInputSchema } from '@finance/shared';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { expect, it } from 'vitest';
import { openDatabase } from '../../src/database/open-database.js';
import * as schema from '../../src/database/schema.js';

it('upgrades a database with a previous-version booking and preserves it', () => {
  const root = mkdtempSync(join(tmpdir(), 'finance-import-upgrade-'));
  const connection = openDatabase(join(root, 'test.db'));
  try {
    const migrations = join(__dirname, '../../src/database/migrations');
    const previous = join(root, 'previous');
    mkdirSync(join(previous, 'meta'), { recursive: true });
    const journal = JSON.parse(readFileSync(join(migrations, 'meta/_journal.json'), 'utf8'));
    journal.entries = journal.entries.slice(0, 2);
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(journal));
    for (const { tag } of journal.entries) copyFileSync(join(migrations, `${tag}.sql`), join(previous, `${tag}.sql`));
    const db = drizzle(connection, { schema });
    migrate(db, { migrationsFolder: previous });
    connection.exec(`
      INSERT INTO institution (id,name) VALUES ('demo-institution','Demo');
      INSERT INTO account (id,institution_id,name,type) VALUES ('demo-account','demo-institution','Cash','cash');
      INSERT INTO "transaction" (id,account_id,booking_date,amount_cents,type,source,fingerprint)
      VALUES ('demo-txn','demo-account','2026-01-01',123,'income','manual','demo-row');
    `);
    migrate(db, { migrationsFolder: migrations });
    expect(db.select().from(schema.transaction).get()).toMatchObject({ amountCents: 123, importJobId: null });
    expect(connection.pragma('foreign_key_check')).toEqual([]);
  } finally {
    connection.close();
    rmSync(root, { recursive: true, force: true });
  }
});

it('rejects missing CSV mappings and invalid regex rules', () => {
  expect(csvMappingInputSchema.safeParse({ columns: { date: 0 } }).success).toBe(false);
  expect(
    ruleInputSchema.safeParse({
      priority: 1,
      matchField: 'purpose',
      operator: 'regex',
      pattern: '[',
      categoryId: '01940000-0000-7000-8000-000000000000',
    }).success,
  ).toBe(false);
});
