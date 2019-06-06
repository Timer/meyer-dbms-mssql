import { BaseDbms, Migration } from 'meyer'
import Knex from 'knex'
import Bluebird from 'bluebird'

let KnexConfig: Knex.Config

function asPromise<T>(x: Bluebird<T>) {
  return new Promise<T>((resolve, reject) => {
    x.then(resolve, reject)
  })
}

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
    if (!(await asPromise(this.knex.schema.hasTable(tableName)))) {
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

    const migrations: Migration[] = (await asPromise(
      this.knex.table(tableName).select('id', 'name', 'up', 'down', 'checksum')
    )) as Migration[]
    return migrations
  }

  applyMigration = async (
    tableName: string,
    migration: Migration,
    opts: {
      checkEffects?: boolean
    }
  ): Promise<void> => {
    await asPromise(
      this.knex.transaction(async trx => {
        await asPromise(trx.raw(migration.up))
        if (opts.checkEffects) {
          await asPromise(trx.raw(migration.down))
          await asPromise(trx.raw(migration.up))
        }
        await asPromise(trx.table(tableName).insert(migration))
      })
    )
  }

  revertMigration = async (
    tableName: string,
    migration: Migration
  ): Promise<void> => {
    await asPromise(
      this.knex.transaction(async trx => {
        await asPromise(trx.raw(migration.down))
        await asPromise(
          trx
            .table(tableName)
            .where('id', migration.id)
            .delete()
        )
      })
    )
  }
}
