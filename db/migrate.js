'use strict';
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function migrate() {
  console.log('⚙  Running database migrations…');
  const migrations = [
    'schema.sql',
    'migrations/001_budget_planner.sql',
    'migrations/002_financial_reports.sql',
  ];
  for (const file of migrations) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`✓  ${file}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.code === '42P07' || err.code === '42701') {
        console.log(`ℹ  ${file} — already applied`);
      } else {
        console.error(`✕  ${file}: ${err.message}`);
        process.exit(1);
      }
    }
  }
  console.log('\n✅ All migrations complete.');
  await pool.end();
}

migrate();
