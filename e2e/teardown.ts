import { rm } from 'node:fs/promises';
import type { FullConfig } from '@playwright/test';

/** Remove the disposable database and its SQLite sidecars. */
export default async function teardown(config: FullConfig): Promise<void> {
  const workDir: unknown = config.metadata.workDir;
  if (typeof workDir === 'string') {
    await rm(workDir, { recursive: true, force: true });
  }
}
