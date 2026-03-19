'use strict';
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db/connection');

const router = express.Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

function parseMonthYear(q) {
  const str = q.month || new Date().toISOString().slice(0, 7);
  const [year, month] = str.split('-').map(Number);
  return { month: month || (new Date().getMonth()+1), year: year || new Date().getFullYear() };
}

const budgetRules = [
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('monthly_budget').isFloat({ min: 1 }).withMessage('Budget must be ≥ ₹1'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1–12'),
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
];

// ── GET /api/budgets ──────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  const { month, year } = parseMonthYear(req.query);
  const userId = req.query.user_id || 'default';
  try {
    // Direct join — works even if budget_summary view is missing
    const { rows } = await db.query(
      `SELECT
         b.id, b.user_id, b.category, b.monthly_budget, b.month, b.year,
         b.created_at, b.updated_at,
         b.monthly_budget                                             AS budget,
         COALESCE(t.actual, 0)                                        AS actual_spending,
         b.monthly_budget - COALESCE(t.actual, 0)                     AS difference,
         ROUND(COALESCE(t.actual,0) / NULLIF(b.monthly_budget,0)*100, 1) AS percentage_used
       FROM budgets b
       LEFT JOIN (
         SELECT category, SUM(amount) AS actual
         FROM transactions
         WHERE type='expense'
           AND EXTRACT(MONTH FROM date)::SMALLINT = $2
           AND EXTRACT(YEAR  FROM date)::SMALLINT = $3
         GROUP BY category
       ) t ON t.category = b.category
       WHERE b.user_id=$1 AND b.month=$2 AND b.year=$3
       ORDER BY b.monthly_budget DESC`,
      [userId, month, year]
    );

    // Unbudgeted categories with spending this month
    const { rows: unbudgeted } = await db.query(
      `SELECT category, SUM(amount) AS actual_spending
       FROM transactions
       WHERE type='expense'
         AND EXTRACT(MONTH FROM date)::SMALLINT=$1
         AND EXTRACT(YEAR  FROM date)::SMALLINT=$2
         AND category NOT IN (
           SELECT category FROM budgets WHERE user_id=$3 AND month=$1 AND year=$2
         )
       GROUP BY category ORDER BY actual_spending DESC`,
      [month, year, userId]
    );

    const totalBudget  = rows.reduce((s,r)=>s+ +r.monthly_budget, 0);
    const totalSpent   = rows.reduce((s,r)=>s+ +r.actual_spending, 0)
                       + unbudgeted.reduce((s,r)=>s+ +r.actual_spending, 0);
    const overspentCount = rows.filter(r=> +r.actual_spending > +r.monthly_budget).length;

    res.json({
      data: rows, unbudgeted, month, year,
      summary: {
        totalBudget, totalSpent,
        totalRemaining: totalBudget - totalSpent,
        overspentCount,
        budgetCount:    rows.length,
        utilizationPct: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/budgets/summary ──────────────────────────────────────────────────
router.get('/summary', async (req, res, next) => {
  const { month, year } = parseMonthYear(req.query);
  const userId = req.query.user_id || 'default';
  try {
    const { rows } = await db.query(
      `SELECT
         b.category, b.monthly_budget AS budget,
         COALESCE(t.actual,0) AS actual_spending,
         b.monthly_budget - COALESCE(t.actual,0) AS difference,
         ROUND(COALESCE(t.actual,0)/NULLIF(b.monthly_budget,0)*100,1) AS percentage_used,
         CASE
           WHEN COALESCE(t.actual,0) >= b.monthly_budget    THEN 'exceeded'
           WHEN COALESCE(t.actual,0) >= b.monthly_budget*.8 THEN 'warning'
           WHEN COALESCE(t.actual,0) >= b.monthly_budget*.5 THEN 'on_track'
           ELSE 'healthy'
         END AS status
       FROM budgets b
       LEFT JOIN (
         SELECT category, SUM(amount) AS actual
         FROM transactions
         WHERE type='expense'
           AND EXTRACT(MONTH FROM date)::SMALLINT=$2
           AND EXTRACT(YEAR  FROM date)::SMALLINT=$3
         GROUP BY category
       ) t ON t.category=b.category
       WHERE b.user_id=$1 AND b.month=$2 AND b.year=$3
       ORDER BY percentage_used DESC NULLS LAST`,
      [userId, month, year]
    );
    res.json({ data: rows, month, year });
  } catch (err) { next(err); }
});

// ── POST /api/budgets ─────────────────────────────────────────────────────────
router.post('/', budgetRules, validate, async (req, res, next) => {
  const { category, monthly_budget, month, year } = req.body;
  const user_id = req.body.user_id || 'default';
  try {
    const { rows } = await db.query(
      `INSERT INTO budgets (user_id, category, monthly_budget, month, year)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, category, month, year)
       DO UPDATE SET monthly_budget=EXCLUDED.monthly_budget, updated_at=NOW()
       RETURNING *`,
      [user_id, category, monthly_budget, month, year]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── PUT /api/budgets/:id ──────────────────────────────────────────────────────
router.put('/:id', [
  param('id').isUUID().withMessage('Invalid ID'),
  body('monthly_budget').isFloat({ min: 1 }).withMessage('Budget must be ≥ ₹1'),
], validate, async (req, res, next) => {
  const { monthly_budget, category } = req.body;
  try {
    const sets  = ['monthly_budget=$1','updated_at=NOW()'];
    const vals  = [monthly_budget];
    if (category) { sets.push(`category=$${vals.length+1}`); vals.push(category); }
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE budgets SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Budget not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/budgets/:id ───────────────────────────────────────────────────
router.delete('/:id', [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(`DELETE FROM budgets WHERE id=$1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Budget not found' });
    res.json({ success: true, id: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
