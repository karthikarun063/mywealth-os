'use strict';
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function migrate() {
  console.log('⚙  Running database migration…');

  // Run base schema
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  // Run budget migration
  const migrationSql = fs.readFileSync(
    path.join(__dirname, 'migrations', '001_budget_planner.sql'), 'utf8'
  );

  try {
    await pool.query(schemaSql);
    console.log('✓  Base schema applied.');

    await pool.query(migrationSql);
    console.log('✓  Budget planner migration applied.');

    console.log('✅ Migration complete.');
  } catch (err) {
    // If tables already exist, that's fine
    if (err.code === '42P07' || err.message.includes('already exists')) {
      console.log('ℹ  Schema already exists — skipping.');
    } else {
      console.error('✕  Migration error:', err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

migrate();
