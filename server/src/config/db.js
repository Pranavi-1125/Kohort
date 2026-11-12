
import mysql from 'mysql2/promise';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const caPath = path.resolve(
  __dirname,
  '../../certs/isrgrootx1.pem'
);

// Use Render's environment variable when available.
// Otherwise, use the local certificate file.
const caCertificate = process.env.DB_SSL_CA_CERT
  ? process.env.DB_SSL_CA_CERT.replace(/\\n/g, '\n')
  : fs.readFileSync(caPath, 'utf8');

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 4000),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kohort',

  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: true,
  charset: 'utf8mb4',

  ssl: {
    ca: caCertificate,
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
});

pool.on('connection', (c) =>
  c.query("SET time_zone = '+00:00'")
);

export const query = async (sql, params = []) =>
  (await pool.query(sql, params))[0];

export const one = async (sql, params = []) =>
  (await query(sql, params))[0] || null;
