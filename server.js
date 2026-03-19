'use strict';
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const path       = require('path');

const { errorHandler, notFound } = require('./middleware/errorHandler');

// ─── Routes ───────────────────────────────────────────────────────────────────
const dashboardRoutes    = require('./routes/dashboard');
const assetsRoutes       = require('./routes/assets');
const liabilitiesRoutes  = require('./routes/liabilities');
const transactionsRoutes = require('./routes/transactions');
const budgetsRoutes      = require('./routes/budgets');
const goalsRoutes        = require('./routes/goals');
const snapshotsRoutes    = require('./routes/snapshots');
const insightsRoutes     = require('./routes/insights');

// ─── App ──────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files (SPA) ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/assets',       assetsRoutes);
app.use('/api/liabilities',  liabilitiesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/budgets',      budgetsRoutes);
app.use('/api/goals',        goalsRoutes);
app.use('/api/snapshots',    snapshotsRoutes);
app.use('/api/insights',     insightsRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    version: '2.0.0',
    stack:   'Node.js + Express + PostgreSQL',
    time:    new Date().toISOString(),
  });
});

// ─── SPA fallback — serve index.html for all non-API routes ──────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ₹  MyWealth OS v2.0.0`);
  console.log(`  🟢 Server running on http://localhost:${PORT}`);
  console.log(`  📦 Stack: Node.js + Express + PostgreSQL`);
  console.log(`  📡 API:   http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
