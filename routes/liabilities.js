'use strict';
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/connection');

const router = express.Router();
const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const VALID_TYPES = ['home_loan','personal_loan','education_loan','car_loan','credit_card'];

const rules = [
  body('name').trim().notEmpty(),
  body('liability_type').isIn(VALID_TYPES),
  body('outstanding_amount').isFloat({ min: 0 }),
  body('interest_rate').isFloat({ min: 0, max: 100 }),
  body('emi').isFloat({ min: 0 }),
];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM liabilities ORDER BY outstanding_amount DESC`);
    const totalDebt = rows.reduce((s, r) => s + parseFloat(r.outstanding_amount), 0);
    const totalEMI  = rows.reduce((s, r) => s + parseFloat(r.emi), 0);
    res.json({ data: rows, summary: { totalDebt, totalEMI, count: rows.length }});
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM liabilities WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Liability not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', rules, validate, async (req, res, next) => {
  const { name, liability_type, outstanding_amount, interest_rate, emi, lender='', due_date=null, notes='' } = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO liabilities(name,liability_type,outstanding_amount,interest_rate,emi,lender,due_date,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, liability_type, outstanding_amount, interest_rate, emi, lender, due_date, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', rules, validate, async (req, res, next) => {
  const { name, liability_type, outstanding_amount, interest_rate, emi, lender='', due_date=null, notes='' } = req.body;
  try {
    const { rows } = await query(
      `UPDATE liabilities SET name=$1,liability_type=$2,outstanding_amount=$3,interest_rate=$4,
       emi=$5,lender=$6,due_date=$7,notes=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,
      [name, liability_type, outstanding_amount, interest_rate, emi, lender, due_date, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Liability not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(`DELETE FROM liabilities WHERE id=$1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Liability not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
