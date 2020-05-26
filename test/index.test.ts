import Knex, { MsSqlConnectionConfig } from 'knex';
import Meyer from 'meyer';
import path from 'path';
import MssqlDbms from '../src';

const config: MsSqlConnectionConfig = {
  server: 'localhost',
  port: 26042,
  user: 'sa',
  password: 'Meyer#123',
  database: 'Testing',
};
const dbms = new MssqlDbms(config);

let setupKnex: Knex;
let testingKnex: Knex;
beforeAll(async () => {
  setupKnex = Knex({
    client: 'mssql',
    connection: { ...config, database: 'master' } as MsSqlConnectionConfig,
  });
  await setupKnex.raw(
    `DROP DATABASE IF EXISTS Testing; CREATE DATABASE Testing;`
  );

  testingKnex = Knex({ client: 'mssql', connection: config });
});

afterAll(async () => {
  if (setupKnex) await setupKnex.destroy();
  if (testingKnex) await testingKnex.destroy();
  await dbms.close();
});

describe('MSSQL Provider', () => {
  test('it runs migrations v1', async () => {
    const m = new Meyer({
      dbms,
      migrationsPath: path.resolve(__dirname, 'migrations-v1'),
    });
    await m.execute();

    expect(await testingKnex.raw(`SELECT * FROM abc;`)).toMatchSnapshot();
  });
  test('it runs migrations v2', async () => {
    const m = new Meyer({
      dbms,
      migrationsPath: path.resolve(__dirname, 'migrations-v2'),
    });
    await m.execute();
    expect(await testingKnex.raw(`SELECT * FROM abc;`)).toMatchSnapshot();
    expect(await testingKnex.raw(`SELECT * FROM def;`)).toMatchSnapshot();
  });
  test('it fails migrations v3 in prod', async () => {
    const m = new Meyer({
      dbms,
      migrationsPath: path.resolve(__dirname, 'migrations-v3'),
    });
    let err;
    try {
      await m.execute();
    } catch (e) {
      err = e;
    }
    expect(err).toMatchSnapshot();
    expect(await testingKnex.raw(`SELECT * FROM abc;`)).toMatchSnapshot();
    expect(await testingKnex.raw(`SELECT * FROM def;`)).toMatchSnapshot();
  });
  test('it runs migrations v3 in dev', async () => {
    const m = new Meyer({
      dbms,
      migrationsPath: path.resolve(__dirname, 'migrations-v3'),
      development: true,
    });
    await m.execute();
    expect(await testingKnex.raw(`SELECT * FROM abc;`)).toMatchSnapshot();
    expect(await testingKnex.raw(`SELECT * FROM jow;`)).toMatchSnapshot();
    expect(
      await testingKnex.raw(
        `IF OBJECT_ID (N'def', N'U') IS NOT NULL SELECT 1 AS [exists] ELSE SELECT 0 AS [exists];`
      )
    ).toMatchObject([{ exists: 0 }]);
  });
});
