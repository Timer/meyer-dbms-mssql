import Meyer from 'meyer'
import MssqlDbms from '../src'
import path from 'path'
import Mssql from 'mssql'

const config = {
  server: 'localhost',
  port: 26042,
  user: 'sa',
  password: 'Meyer#123'
}
const dbms = new MssqlDbms({ ...config, database: 'Testing' })

let pool: Mssql.ConnectionPool
beforeAll(async () => {
  pool = new Mssql.ConnectionPool({
    ...config,
    pool: { min: 0, max: 1, idleTimeoutMillis: 1 }
  } as Mssql.config)
  await pool.connect()
  await pool.query`DROP DATABASE IF EXISTS Testing; CREATE DATABASE Testing;`
  await pool.close()

  pool = new Mssql.ConnectionPool({
    ...config,
    database: 'Testing',
    pool: { min: 0, max: 1, idleTimeoutMillis: 1 }
  } as Mssql.config)
  await pool.connect()
})

afterAll(async () => {
  await pool.close()
})

describe('MSSQL Provider', () => {
  test('it runs migrations v1', async () => {
    const m = new Meyer({
      dbms,
      migrationsPath: path.resolve(__dirname, 'migrations-v1')
    })
    await m.execute()

    expect((await pool.query`SELECT * FROM abc;`).recordset).toMatchSnapshot()
  })
  test('it runs migrations v2', async () => {
    const m = new Meyer({
      dbms,
      migrationsPath: path.resolve(__dirname, 'migrations-v2')
    })
    await m.execute()
    expect((await pool.query`SELECT * FROM abc;`).recordset).toMatchSnapshot()
    expect((await pool.query`SELECT * FROM def;`).recordset).toMatchSnapshot()
  })
  test('it fails migrations v3 in prod', async () => {
    const m = new Meyer({
      dbms,
      migrationsPath: path.resolve(__dirname, 'migrations-v3')
    })
    let err
    try {
      await m.execute()
    } catch (e) {
      err = e
    }
    expect(err).toMatchSnapshot()
    expect((await pool.query`SELECT * FROM abc;`).recordset).toMatchSnapshot()
    expect((await pool.query`SELECT * FROM def;`).recordset).toMatchSnapshot()
  })
  test('it runs migrations v3 in dev', async () => {
    const m = new Meyer({
      dbms,
      migrationsPath: path.resolve(__dirname, 'migrations-v3'),
      development: true
    })
    await m.execute()
    expect((await pool.query`SELECT * FROM abc;`).recordset).toMatchSnapshot()
    expect((await pool.query`SELECT * FROM jow;`).recordset).toMatchSnapshot()
    expect(
      (await pool.query`IF OBJECT_ID (N'def', N'U') IS NOT NULL SELECT 1 AS [exists] ELSE SELECT 0 AS [exists];`)
        .recordset
    ).toMatchObject([{ exists: 0 }])
  })
})
