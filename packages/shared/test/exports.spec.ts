import { expect, it } from 'vitest';
import * as shared from '../src/index.js';

it('loads the shared package entry point', () => {
  expect(shared).toBeDefined();
});
