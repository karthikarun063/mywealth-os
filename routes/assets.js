'use strict';
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/connection');

const router = express.Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const VALID_CLASSES = [
  'stocks','mutual_funds','etf','crypto','bank_account','cash',
  'fixed_deposit','epf','ppf','nps','gold','real_estate',
  'vehicle','foreign_assets','others',
];

const assetRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('asset_class').isIn(VALID_CLASSES).withMessage('Invalid asset class'),
  body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be >= 0'),
  body('purchase_value').isFloat({ min: 0 }).withMessage('Purchase value must be >= 0'),
  body('current_value').isFloat({ min: 0 }).withMessage('Current value must be >= 0'),
  body('currency').optional().isLength({ min:3, max:3 }),
];

// GET /api/assets
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM assets ORDER BY current_value DESC`
    );
    // Attach portfolio summary
    const total = rows.reduce((s, r) => s + parseFloat(r.current_value), 0);
    const totalPurchase = rows.reduce((s, r) => s + parseFloat(r.purchase_value), 0);
    res.json({ data: rows, summary: { total, totalPurchase, gain: total - totalPurchase, count: rows.length }});
  } catch (err) { next(err); }
});

// GET /api/assets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM assets WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/assets
router.post('/', assetRules, validate, async (req, res, next) => {
  const { name, asset_class, quantity=1, purchase_value, current_value, currency='INR', notes='' } = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO assets(name,asset_class,quantity,purchase_value,current_value,currency,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, asset_class, quantity, purchase_value, current_value, currency, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/assets/:id
router.put('/:id', assetRules, validate, async (req, res, next) => {
  const { name, asset_class, quantity=1, purchase_value, current_value, currency='INR', notes='' } = req.body;
  try {
    const { rows } = await query(
      `UPDATE assets SET name=$1,asset_class=$2,quantity=$3,purchase_value=$4,
       current_value=$5,currency=$6,notes=$7,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, asset_class, quantity, purchase_value, current_value, currency, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/assets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(`DELETE FROM assets WHERE id=$1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Asset not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
