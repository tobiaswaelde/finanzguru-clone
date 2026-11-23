import tseslint from 'typescript-eslint';
import withNuxt from './apps/web/.nuxt/eslint.config.mjs';

export default withNuxt(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/test-results/**', '**/playwright-report/**', '**/.specify/**'],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['apps/api/**/*.{ts,mts}', 'packages/**/*.ts', 'e2e/**/*.ts'],
  })),
  {
    files: ['apps/api/**/*.ts'],
    rules: { '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }] },
  },
  {
    files: ['apps/web/app/pages/**/*.vue', 'apps/web/app/layouts/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    files: ['apps/web/**/*.vue'],
    rules: {
      'vue/block-order': ['error', { order: ['template', 'script', 'style'] }],
      'vue/attributes-order': [
        'error',
        {
          order: [
            'DEFINITION',
            'LIST_RENDERING',
            'CONDITIONALS',
            'RENDER_MODIFIERS',
            'UNIQUE',
            'TWO_WAY_BINDING',
            'OTHER_DIRECTIVES',
            'GLOBAL',
            'ATTR_STATIC',
            'ATTR_DYNAMIC',
            'EVENTS',
            'CONTENT',
          ],
        },
      ],
    },
  },
);
