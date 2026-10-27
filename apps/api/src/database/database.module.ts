import { Global, Injectable, Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppConfig } from '../config/app-config.js';
import { ENTITIES } from '../core/entities.js';
import { runMigrations } from './migrator.js';
import { TenantDb } from './tenant-db.js';

@Injectable()
class MigrationRunner implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource, private readonly config: AppConfig) {}

  async onApplicationBootstrap() {
    // Dev and test apply migrations on start. Production runs `node dist/database/migrate-cli.js` before deploy.
    if (!this.config.env.RUN_MIGRATIONS) return;
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runMigrations({ query: (sql, params) => runner.query(sql, params) });
    } finally {
      await runner.release();
    }
  }
}

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfig],
      useFactory: ({ env }: AppConfig) => ({
        type: 'postgres' as const,
        ...(env.DATABASE_URL
          ? { url: env.DATABASE_URL }
          : { host: env.DB_HOST, port: env.DB_PORT, username: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE }),
        ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
        entities: ENTITIES,
        // Never synchronize: the SQL files in scripts/migrations are the schema.
        synchronize: false,
        logging: false,
      }),
    }),
  ],
  providers: [TenantDb, MigrationRunner],
  exports: [TenantDb, TypeOrmModule],
})
export class DatabaseModule {}
