import { expect, it } from 'vitest';
import { NotImplementedError } from '../../src/modules/sources/errors.js';
import { SourcesRegistry } from '../../src/modules/sources/sources.registry.js';
import { SparkasseFintsSource } from '../../src/modules/sources/sparkasse-fints/sparkasse-fints.source.js';

it('exposes a planned adapter that never fetches bank data', async () => {
  const registry = new SourcesRegistry();
  registry.register(new SparkasseFintsSource());
  const source = registry.get('sparkasse_fints');
  await expect(source.status()).resolves.toBe('planned');
  await expect(source.fetch({ kind: 'pull' })).rejects.toBeInstanceOf(NotImplementedError);
});
