import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../../src/database/open-database.js';

it('opens a file database in WAL mode and enforces foreign keys', () => {
  const root = mkdtempSync(join(tmpdir(), 'finance-db-'));
  try {
    const database = openDatabase(join(root, 'nested', 'test.db'));
    try {
      expect(database.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
      database.exec('CREATE TABLE parent (id INT PRIMARY KEY); CREATE TABLE child (parent INT REFERENCES parent(id));');
      expect(() => database.prepare('INSERT INTO child VALUES (1)').run()).toThrow(/FOREIGN KEY/);
    } finally {
      database.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
