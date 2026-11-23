# Coding guidelines

Use Node 26 and the pnpm version pinned in the root manifest. Use strict TypeScript and narrow external input at application boundaries. Keep contracts in `packages/shared` and framework-independent calculations in the API domain layer.

- Use two spaces, LF, single quotes in JavaScript/TypeScript, semicolons, trailing commas, and a 120-character line width. Keep generated output and lockfiles out of style-only changes.
- Document functions, methods, callbacks, composables, and exported types with concise JSDoc. Describe relevant units, constraints, effects, failures, and ownership. Documentation coverage is reviewed manually.
- In Vue SFCs, order blocks as template, script setup, then style. Use typed props and events. Order attributes as structural directives, identity, models and directives, global attributes, static bindings, dynamic bindings, events, then content. Preserve significant whitespace and keep closing delimiters of multiline tags on separate lines.
- Keep UI copy in German locale files, preserve accessible names and keyboard behavior, and use existing Nuxt UI components.

From the workspace root, use `pnpm lint`, `pnpm format:check`, and `pnpm typecheck` for read-only checks; use `pnpm format` for explicit formatting fixes. See the feature quickstart for test, browser, and container checks.
