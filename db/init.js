'use strict';
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    console.log('⚙  Running schema migration…');
    await pool.query(sql);
    console.log('✓  Schema applied successfully.');
  } catch (err) {
    console.error('✕  Schema error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
