'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

/**
 * Run a parameterised query.
 * @param {string} text  - SQL query string with $1, $2 placeholders
 * @param {Array}  params - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  const res   = await pool.query(text, params);
  const dur   = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] ${text.slice(0, 60)}… | ${dur}ms | rows: ${res.rowCount}`);
  }
  return res;
}

module.exports = { pool, query };
