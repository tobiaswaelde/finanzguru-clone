import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, type FullConfig } from '@playwright/test';

const apiPort = process.env.E2E_API_PORT ?? '13101';
const webPort = process.env.E2E_WEB_PORT ?? '13100';
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

const workDir = mkdtempSync(join(tmpdir(), 'finance-e2e-'));

export default defineConfig({
  testDir: '.',
  globalTeardown: './teardown.ts',
  metadata: { workDir } satisfies FullConfig['metadata'],
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: webUrl, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      command:
        'pnpm --filter api... build && pnpm --filter api db:migrate && node e2e/fixture-password.mjs | pnpm --filter api owner:set-password && pnpm --filter api start',
      cwd: '..',
      port: Number(apiPort),
      env: {
        PORT: apiPort,
        DATABASE_PATH: join(workDir, 'app.db'),
        COOKIE_SECURE: 'false',
        API_SESSION_SECRET: 'synthetic-playwright-secret-000000',
        API_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
      },
    },
    {
      command: `pnpm --filter web exec nuxt dev --host 127.0.0.1 --port ${webPort}`,
      cwd: '..',
      url: webUrl,
      env: { NUXT_API_BASE_URL: apiUrl, API_BASE_URL: apiUrl },
    },
  ],
});
