# API

The API runs on Node 26 and uses Drizzle with the native `better-sqlite3` driver. The workspace permits that dependency's install script. If no prebuilt binary is available, the local build needs Python 3, Make, and a C++ toolchain. The Docker builder already provides these tools.

`DATABASE_PATH` defaults to `./data/app.db` when running from `apps/api`; the container uses `/data/app.db`. SQLite enables WAL and foreign keys on startup. Mount a writable data directory for a non-root container; do not store real databases or secrets in Git.

For a disposable driver check, run `pnpm --filter api test` locally. The Docker image build and runtime checks use synthetic data only.

Verified on Node 26 with `better-sqlite3` 13.2.0: a disposable file database passed the WAL and foreign-key tests; the Docker runtime loaded the driver and executed `SELECT 1` against an in-memory database.

The API skips checking third-party declarations because Drizzle exports types for optional database drivers that this application does not install. Project source remains strictly type-checked.

Run `pnpm --filter api build` and then `pnpm --filter api db:migrate` against a new database before using it. Back up an existing database before applying new migrations. The initial migration only adds tables and indexes; recovery from a failed upgrade uses a verified backup, not a destructive schema reset.
