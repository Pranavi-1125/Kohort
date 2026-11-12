// Creates the database and all tables: `npm run db:init`
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import 'dotenv/config';

const sql = fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8');
const dbName = process.env.DB_NAME || 'kohort';
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true,
});
await conn.query(sql.replaceAll('kohort', dbName));
console.log(`Database "${dbName}" is ready.`);
await conn.end();
