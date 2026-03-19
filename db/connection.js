'use strict';
require('dotenv').config();
const { Pool } = require('pg');

// ── Neon + Vercel serverless optimised connection ─────────────────────────────
// Neon uses PgBouncer pooler (-pooler in hostname) — keep pool small.
// SSL must ALWAYS be true for Neon (not just in production).

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ||
       process.env.DATABASE_URL?.includes('sslmode')
    ? { rejectUnauthorized: false }
    : false,
  max:                    2,    // keep tiny for serverless
  min:                    0,
  idleTimeoutMillis:      10000,
  connectionTimeoutMillis:5000,
  allowExitOnIdle:        true, // let process exit cleanly in serverless
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

/**
 * Execute a parameterised SQL query.
 * Automatically logs slow queries (>200ms) in development.
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const ms  = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' || ms > 200) {
      console.log(`[DB] ${ms}ms | ${text.slice(0, 80).replace(/\s+/g,' ')}`);
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text.slice(0, 200));
    throw err;
  }
}

module.exports = { pool, query };
