import { expect, it, vi } from 'vitest';
import type { DataSource } from '../../src/modules/sources/data-source.interface.js';
import { NotImplementedError } from '../../src/modules/sources/errors.js';
import { SourcesRegistry } from '../../src/modules/sources/sources.registry.js';

it('resolves a registered source and rejects missing or duplicate adapters without fetching', () => {
  const registry = new SourcesRegistry();
  const source: DataSource = { kind: 'csv', status: vi.fn(), fetch: vi.fn() };
  expect(() => registry.get('csv')).toThrow(NotImplementedError);
  registry.register(source);
  expect(registry.get('csv')).toBe(source);
  expect(() => registry.register(source)).toThrow(/Duplicate/);
  expect(source.fetch).not.toHaveBeenCalled();
});
