'use strict';
const express = require('express');
const { body, query: qv, param, validationResult } = require('express-validator');
const db = require('../db/connection');

const router = express.Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse ?month=YYYY-MM or default to current month, return { month, year } */
function parseMonthYear(query) {
  const str = query.month || new Date().toISOString().slice(0, 7);
  const [year, month] = str.split('-').map(Number);
  return { month, year };
}

// ── Validation rules ─────────────────────────────────────────────────────────

const budgetRules = [
  body('category')
    .trim().notEmpty().withMessage('Category is required')
    .isIn(['rent','groceries','transport','shopping','utilities','insurance',
           'education','medical','entertainment','travel','investments','food',
           'dining','subscriptions','personal_care','other'])
    .withMessage('Invalid category'),
  body('monthly_budget')
    .isFloat({ min: 1 }).withMessage('Budget must be at least ₹1'),
  body('month')
    .isInt({ min: 1, max: 12 }).withMessage('Month must be 1–12'),
  body('year')
    .isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
];

// ── GET /api/budgets ─────────────────────────────────────────────────────────
// Returns all budgets for a given month/year with actual spending joined in.
// Query params: month=YYYY-MM  (defaults to current month)
router.get('/', async (req, res, next) => {
  const { month, year } = parseMonthYear(req.query);
  const userId = req.query.user_id || 'default';

  try {
    // Use the budget_summary view for a clean single query
    const { rows } = await db.query(
      `SELECT * FROM budget_summary
       WHERE user_id = $1 AND month = $2 AND year = $3
       ORDER BY budget DESC`,
      [userId, month, year]
    );

    // Also pull any unbudgeted categories that have spending this month
    const { rows: unbudgeted } = await db.query(
      `SELECT
         category,
         SUM(amount) AS actual_spending,
         0::NUMERIC   AS budget,
         -SUM(amount) AS difference,
         NULL          AS percentage_used
       FROM transactions
       WHERE type = 'expense'
         AND EXTRACT(MONTH FROM date) = $1
         AND EXTRACT(YEAR  FROM date) = $2
         AND category NOT IN (
           SELECT category FROM budgets
           WHERE user_id = $3 AND month = $1 AND year = $2
         )
       GROUP BY category
       ORDER BY actual_spending DESC`,
      [month, year, userId]
    );

    const totalBudget  = rows.reduce((s, r) => s + parseFloat(r.budget),          0);
    const totalSpent   = rows.reduce((s, r) => s + parseFloat(r.actual_spending),  0) +
                         unbudgeted.reduce((s, r) => s + parseFloat(r.actual_spending), 0);
    const overspentCount = rows.filter(r => parseFloat(r.actual_spending) > parseFloat(r.budget)).length;

    res.json({
      data:      rows,
      unbudgeted,
      month,
      year,
      summary: {
        totalBudget,
        totalSpent,
        totalRemaining:  totalBudget - totalSpent,
        overspentCount,
        budgetCount:     rows.length,
        utilizationPct:  totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/budgets/summary ─────────────────────────────────────────────────
// Structured summary per category with difference and % used.
// Used by the dashboard Budget Status card.
router.get('/summary', async (req, res, next) => {
  const { month, year } = parseMonthYear(req.query);
  const userId = req.query.user_id || 'default';

  try {
    const { rows } = await db.query(
      `SELECT
         category,
         budget,
         actual_spending,
         difference,
         percentage_used,
         CASE
           WHEN percentage_used >= 100 THEN 'exceeded'
           WHEN percentage_used >= 80  THEN 'warning'
           WHEN percentage_used >= 50  THEN 'on_track'
           ELSE 'healthy'
         END AS status
       FROM budget_summary
       WHERE user_id = $1 AND month = $2 AND year = $3
       ORDER BY percentage_used DESC NULLS LAST`,
      [userId, month, year]
    );
    res.json({ data: rows, month, year });
  } catch (err) { next(err); }
});

// ── POST /api/budgets ────────────────────────────────────────────────────────
// Creates or updates a budget (upsert on user+category+month+year).
router.post('/', budgetRules, validate, async (req, res, next) => {
  const { category, monthly_budget, month, year } = req.body;
  const user_id = req.body.user_id || 'default';

  try {
    const { rows } = await db.query(
      `INSERT INTO budgets (user_id, category, monthly_budget, month, year)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, category, month, year)
       DO UPDATE SET monthly_budget = EXCLUDED.monthly_budget,
                     updated_at     = NOW()
       RETURNING *`,
      [user_id, category, monthly_budget, month, year]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── PUT /api/budgets/:id ─────────────────────────────────────────────────────
// Updates an existing budget entry by ID.
router.put('/:id',
  [
    param('id').isUUID().withMessage('Invalid budget ID'),
    body('monthly_budget').isFloat({ min: 1 }).withMessage('Budget must be at least ₹1'),
    body('category').optional().trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    const { monthly_budget, category } = req.body;
    try {
      // Build dynamic update — only update provided fields
      const updates = ['monthly_budget = $1', 'updated_at = NOW()'];
      const values  = [monthly_budget];

      if (category) {
        updates.push(`category = $${values.length + 1}`);
        values.push(category);
      }

      values.push(req.params.id);

      const { rows } = await db.query(
        `UPDATE budgets
         SET ${updates.join(', ')}
         WHERE id = $${values.length}
         RETURNING *`,
        values
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Budget not found' });
      }
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/budgets/:id ──────────────────────────────────────────────────
router.delete('/:id',
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const { rowCount } = await db.query(
        `DELETE FROM budgets WHERE id = $1`, [req.params.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Budget not found' });
      res.json({ success: true, id: req.params.id });
    } catch (err) { next(err); }
  }
);

module.exports = router;
