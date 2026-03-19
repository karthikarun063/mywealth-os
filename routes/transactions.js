'use strict';
const express = require('express');
const { body, query: qv, validationResult } = require('express-validator');
const db = require('../db/connection');

const router = express.Router();
const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const rules = [
  body('type').isIn(['income','expense']),
  body('category').trim().notEmpty(),
  body('amount').isFloat({ min: 0.01 }),
  body('date').isDate(),
];

// GET /api/transactions?type=&category=&page=&limit=&month=
router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(100, parseInt(req.query.limit) || 25);
    const offset   = (page - 1) * limit;
    const type     = req.query.type     || null;
    const category = req.query.category || null;
    const month    = req.query.month    || null;

    const conditions = [];
    const params     = [];

    if (type)     { params.push(type);     conditions.push(`type = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
    if (month)    { params.push(month+'%'); conditions.push(`date::TEXT LIKE $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [{ rows }, { rows: countRows }] = await Promise.all([
      db.query(`SELECT * FROM transactions ${where} ORDER BY date DESC, created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, limit, offset]),
      db.query(`SELECT COUNT(*) FROM transactions ${where}`, params),
    ]);

    const total     = parseInt(countRows[0].count);
    const totalInc  = rows.filter(r => r.type==='income').reduce((s,r) => s+parseFloat(r.amount), 0);
    const totalExp  = rows.filter(r => r.type==='expense').reduce((s,r) => s+parseFloat(r.amount), 0);

    res.json({
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total/limit) },
      summary: { totalIncome: totalInc, totalExpense: totalExp, net: totalInc - totalExp },
    });
  } catch (err) { next(err); }
});

// GET monthly summary for charts
router.get('/monthly-summary', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        TO_CHAR(date, 'YYYY-MM') AS month,
        SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
      FROM transactions
      WHERE date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month ORDER BY month ASC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET category totals
router.get('/category-totals', async (req, res, next) => {
  const month = req.query.month || new Date().toISOString().slice(0,7);
  try {
    const { rows } = await db.query(`
      SELECT category, SUM(amount) AS total
      FROM transactions
      WHERE type='expense' AND TO_CHAR(date,'YYYY-MM')=$1
      GROUP BY category ORDER BY total DESC
    `, [month]);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', rules, validate, async (req, res, next) => {
  const { type, category, amount, date, notes='', recurring=false } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO transactions(type,category,amount,date,notes,recurring) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [type, category, amount, date, notes, recurring]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(`DELETE FROM transactions WHERE id=$1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
