'use strict';
const express = require('express');
const db = require('../db/connection');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT * FROM snapshots ORDER BY month DESC LIMIT 24`);
    res.json(rows);
  } catch (err) { next(err); }
});

// Auto-generate snapshot for current month
router.post('/generate', async (req, res, next) => {
  try {
    const month = new Date().toISOString().slice(0,7);
    const [{ rows: aRows }, { rows: lRows }, { rows: txRows }] = await Promise.all([
      db.query(`SELECT SUM(current_value) AS total FROM assets`),
      db.query(`SELECT SUM(outstanding_amount) AS total FROM liabilities`),
      db.query(`
        SELECT
          SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
          SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
        FROM transactions WHERE TO_CHAR(date,'YYYY-MM')=$1
      `, [month]),
    ]);

    const ta  = parseFloat(aRows[0].total  || 0);
    const tl  = parseFloat(lRows[0].total  || 0);
    const inc = parseFloat(txRows[0].income  || 0);
    const exp = parseFloat(txRows[0].expense || 0);
    const sr  = inc > 0 ? ((inc-exp)/inc)*100 : 0;

    const { rows } = await db.query(
      `INSERT INTO snapshots(month,total_assets,total_liabilities,net_worth,savings_rate)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(month)
       DO UPDATE SET total_assets=$2,total_liabilities=$3,net_worth=$4,savings_rate=$5 RETURNING *`,
      [month, ta, tl, ta-tl, sr.toFixed(2)]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
