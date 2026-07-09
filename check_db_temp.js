const path = require('path');
const { PrismaClient } = require('@prisma/client');
const dbPath = path.resolve('dist/main/prisma/funklobby.db');
console.log('DB path:', dbPath);
const p = new PrismaClient({ datasources: { db: { url: 'file:' + dbPath } } });
async function test() {
  await p.$connect();
  const tables = await p.$queryRawUnsafe("SELECT name, sql FROM sqlite_master WHERE type='table'");
  console.log('Tables:', JSON.stringify(tables, null, 2));
  const raw = await p.$queryRawUnsafe("SELECT id, name, createdAt FROM Profile");
  console.log('Raw profiles:', JSON.stringify(raw, null, 2));
  await p.$disconnect();
}
test().catch(e => { console.error(e.message); process.exit(1); });
