import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { openDatabase } from './open-database.js';

export const DB = Symbol('DB');

/** Owns the connection until Nest shuts down. */
class ManagedDatabase implements OnApplicationShutdown {
  readonly db;

  constructor(private readonly connection: Database.Database) {
    this.db = drizzle(connection);
  }

  /** Close the underlying SQLite connection. */
  onApplicationShutdown(): void {
    this.connection.close();
  }
}

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
