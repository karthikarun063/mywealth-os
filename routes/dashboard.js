'use strict';
const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/dashboard — everything needed for the dashboard in one round-trip
router.get('/', async (req, res, next) => {
  const month = new Date().toISOString().slice(0,7);
  try {
    const now   = new Date();
    const curMo  = now.getMonth() + 1;
    const curYr  = now.getFullYear();

    const [assets, liabs, txSummary, catTotals, snaps, budgets] = await Promise.all([
      db.query(`SELECT asset_class, SUM(current_value) AS value, SUM(purchase_value) AS cost FROM assets GROUP BY asset_class ORDER BY value DESC`),
      db.query(`SELECT SUM(outstanding_amount) AS total, SUM(emi) AS emi FROM liabilities`),
      db.query(`
        SELECT
          SUM(CASE WHEN type='income'  AND TO_CHAR(date,'YYYY-MM')=$1 THEN amount ELSE 0 END) AS cur_income,
          SUM(CASE WHEN type='expense' AND TO_CHAR(date,'YYYY-MM')=$1 THEN amount ELSE 0 END) AS cur_expense
        FROM transactions
      `, [month]),
      db.query(`
        SELECT category, SUM(amount) AS total FROM transactions
        WHERE type='expense' AND TO_CHAR(date,'YYYY-MM')=$1 GROUP BY category ORDER BY total DESC LIMIT 6
      `, [month]),
      db.query(`SELECT * FROM snapshots ORDER BY month DESC LIMIT 12`),
      db.query(`
        SELECT
          b.category,
          b.monthly_budget                              AS budget,
          COALESCE(t.actual, 0)                         AS actual_spending,
          b.monthly_budget - COALESCE(t.actual, 0)      AS difference,
          ROUND(COALESCE(t.actual, 0) / NULLIF(b.monthly_budget, 0) * 100, 1) AS percentage_used
        FROM budgets b
        LEFT JOIN (
          SELECT category, SUM(amount) AS actual
          FROM transactions
          WHERE type = 'expense'
            AND EXTRACT(MONTH FROM date) = $1
            AND EXTRACT(YEAR  FROM date) = $2
          GROUP BY category
        ) t ON t.category = b.category
        WHERE b.month = $1 AND b.year = $2
        ORDER BY percentage_used DESC NULLS LAST
        LIMIT 6
      `, [curMo, curYr]),
    ]);

    const totalAssets     = assets.rows.reduce((s,r) => s + parseFloat(r.value), 0);
    const totalPurchase   = assets.rows.reduce((s,r) => s + parseFloat(r.cost),  0);
    const totalLiabilities = parseFloat(liabs.rows[0].total || 0);
    const totalEMI         = parseFloat(liabs.rows[0].emi   || 0);
    const income           = parseFloat(txSummary.rows[0].cur_income  || 0);
    const expense          = parseFloat(txSummary.rows[0].cur_expense || 0);
    const savingsRate      = income > 0 ? ((income - expense) / income) * 100 : 0;

    res.json({
      netWorth:         totalAssets - totalLiabilities,
      totalAssets,
      totalPurchase,
      totalLiabilities,
      totalEMI,
      income,
      expense,
      savingsRate,
      unrealisedGain:   totalAssets - totalPurchase,
      byClass:          assets.rows,
      topExpenses:      catTotals.rows,
      snapshots:        snaps.rows.reverse(),
      budgetStatus:     budgets.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
