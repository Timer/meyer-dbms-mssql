import { BaseDbms, Migration } from 'meyer'
import Knex from 'knex'

let KnexConfig: Knex.Config

export default class MssqlDbms extends BaseDbms {
  private knex: Knex

  constructor(config: typeof KnexConfig.connection) {
    super()
    this.knex = Knex({
      client: 'mssql',
      connection: config,
      pool: { min: 0, max: 1, idleTimeoutMillis: 1 }
    })
  }

  listMigrations = async (tableName: string): Promise<Migration[]> => {
    if (!(await this.knex.schema.hasTable(tableName))) {
      await new Promise((resolve, reject) =>
        this.knex.schema
          .createTable(tableName, table => {
            table
              .integer('id')
              .primary()
              .notNullable()
            table.text('name').notNullable()
            table.text('up').notNullable()
            table.text('down').notNullable()
            table.text('checksum').notNullable()
          })
          .then(resolve, reject)
      )
    }

    const migrations: {
      id: number
      name: string
      up: string
      down: string
      checksum: string
    }[] = (await this.knex
      .table(tableName)
      .select('id', 'name', 'up', 'down', 'checksum')) as any
    return migrations
  }

  applyMigration = async (
    tableName: string,
    migration: Migration,
    opts: {
      checkEffects?: boolean
    }
  ): Promise<void> => {
    await this.knex.transaction(async trx => {
      await trx.raw(migration.up)
      if (opts.checkEffects) {
        await trx.raw(migration.down)
        await trx.raw(migration.up)
      }
      await trx.table(tableName).insert(migration)
    })
  }

  revertMigration = async (
    tableName: string,
    migration: Migration
  ): Promise<void> => {
    await this.knex.transaction(async trx => {
      await trx.raw(migration.down)
      await trx
        .table(tableName)
        .where('id', migration.id)
        .delete()
    })
  }
}
