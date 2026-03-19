'use strict';
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/connection');

const router = express.Router();
const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const rules = [
  body('goal_name').trim().notEmpty(),
  body('target_amount').isFloat({ min: 1 }),
  body('current_amount').optional().isFloat({ min: 0 }),
  body('monthly_contribution').optional().isFloat({ min: 0 }),
  body('expected_return').optional().isFloat({ min: 0, max: 100 }),
];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT * FROM goals ORDER BY created_at ASC`);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', rules, validate, async (req, res, next) => {
  const { goal_name, goal_type='other', target_amount, current_amount=0,
          monthly_contribution=0, target_date=null, expected_return=10, notes='' } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO goals(goal_name,goal_type,target_amount,current_amount,monthly_contribution,target_date,expected_return,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [goal_name,goal_type,target_amount,current_amount,monthly_contribution,target_date,expected_return,notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', rules, validate, async (req, res, next) => {
  const { goal_name, goal_type='other', target_amount, current_amount=0,
          monthly_contribution=0, target_date=null, expected_return=10, notes='' } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE goals SET goal_name=$1,goal_type=$2,target_amount=$3,current_amount=$4,
       monthly_contribution=$5,target_date=$6,expected_return=$7,notes=$8,updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [goal_name,goal_type,target_amount,current_amount,monthly_contribution,target_date,expected_return,notes,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Goal not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(`DELETE FROM goals WHERE id=$1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Goal not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
