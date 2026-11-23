import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, type FullConfig } from '@playwright/test';

const apiPort = process.env.E2E_API_PORT ?? '13101';
const webPort = process.env.E2E_WEB_PORT ?? '13100';
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const perf = process.env.FINANCE_PERF === 'true';
const dev = process.env.FINANCE_DEV === 'true';
const seed = `pnpm --filter api... build && pnpm --filter api db:migrate && pnpm --filter api db:seed ${perf ? '--perf' : '--demo'} && node e2e/fixture-password.mjs | pnpm --filter api owner:set-password`;
const workDir = mkdtempSync(join(tmpdir(), 'finance-e2e-'));
const apiEnv = {
  PORT: apiPort,
  DATABASE_PATH: join(workDir, 'app.db'),
  COOKIE_SECURE: 'false',
  API_SESSION_SECRET: 'synthetic-playwright-secret-000000',
  API_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
};

export default defineConfig({
  testDir: '.',
  globalSetup: './setup.ts',
  globalTeardown: './teardown.ts',
  metadata: { workDir } satisfies FullConfig['metadata'],
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: { baseURL: webUrl, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
  ],
  webServer:
    dev && !perf
      ? {
          command: `${seed} && pnpm dev`,
          cwd: '..',
          url: `${webUrl}/api/health`,
          timeout: 120_000,
          env: {
            ...apiEnv,
            NUXT_HOST: '127.0.0.1',
            NUXT_PORT: webPort,
            NUXT_API_BASE_URL: apiUrl,
            API_BASE_URL: apiUrl,
          },
        }
      : [
          {
            command: `${seed} && pnpm --filter api start`,
            cwd: '..',
            port: Number(apiPort),
            env: apiEnv,
          },
          {
            command: perf
              ? 'pnpm --filter web... build && node apps/web/.output/server/index.mjs'
              : `pnpm --filter web exec nuxt dev --host 127.0.0.1 --port ${webPort}`,
            cwd: '..',
            url: webUrl,
            timeout: 120_000,
            env: { NUXT_API_BASE_URL: apiUrl, API_BASE_URL: apiUrl, NITRO_HOST: '127.0.0.1', NITRO_PORT: webPort },
          },
        ],
});
