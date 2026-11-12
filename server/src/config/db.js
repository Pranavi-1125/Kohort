import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kohort',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: true, // DATE/DATETIME come back as plain strings
  charset: 'utf8mb4',
});

pool.on('connection', (c) => c.query("SET time_zone = '+00:00'"));

export const query = async (sql, params = []) => (await pool.query(sql, params))[0];
export const one = async (sql, params = []) => (await query(sql, params))[0] || null;
