import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/unit/**/*.spec.ts'] } },
      { extends: true, test: { name: 'e2e', include: ['test/e2e/**/*.e2e-spec.ts'] } },
    ],
  },
});
