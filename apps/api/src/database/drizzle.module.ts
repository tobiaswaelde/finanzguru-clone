import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { openDatabase } from './open-database.js';
import * as schema from './schema.js';

export const DB = Symbol('DB');

/** Owns the connection until Nest shuts down. */
class ManagedDatabase implements OnApplicationShutdown {
  readonly db;

  constructor(private readonly connection: Database.Database) {
    this.db = drizzle(connection, { schema });
  }

  /** Close the underlying SQLite connection. */
  onApplicationShutdown(): void {
    this.connection.close();
  }
}

/** Typed Drizzle client injected using the DB token. */
export type FinanceDatabase = ManagedDatabase['db'];
/** Active SQLite transaction with the same schema as the injected client. */
export type FinanceTransaction = Parameters<Parameters<FinanceDatabase['transaction']>[0]>[0];

/** Makes the SQLite-backed Drizzle client available to API modules. */
@Global()
@Module({
  providers: [
    {
      provide: ManagedDatabase,
      /** Open the validated database path. */
      useFactory: () => new ManagedDatabase(openDatabase(process.env.DATABASE_PATH ?? './data/app.db')),
    },
    {
      provide: DB,
      inject: [ManagedDatabase],
      /** Expose the ORM client while Nest owns the connection lifecycle. */
      useFactory: (managed: ManagedDatabase) => managed.db,
    },
  ],
  exports: [DB],
})
export class DrizzleModule {}
