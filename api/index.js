'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { errorHandler, notFound } = require('../middleware/errorHandler');

// ── Route imports ─────────────────────────────────────────────────────────────
const dashboardRoutes    = require('../routes/dashboard');
const assetsRoutes       = require('../routes/assets');
const liabilitiesRoutes  = require('../routes/liabilities');
const transactionsRoutes = require('../routes/transactions');
const budgetsRoutes      = require('../routes/budgets');
const goalsRoutes        = require('../routes/goals');
const snapshotsRoutes    = require('../routes/snapshots');
const insightsRoutes     = require('../routes/insights');
const strategyRoutes     = require('../routes/strategy');
const reportRoutes       = require('../routes/report');

const app = express();

// ── CORS — allow all origins, all methods including PUT/DELETE ────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Handle OPTIONS preflight for every route
app.options('*', cors());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check (registered FIRST so nothing catches it) ─────────────────────
app.get('/api/health', (req, res) => res.json({
  status:  'ok',
  version: '2.1.0',
  db:      !!process.env.DATABASE_URL,
  time:    new Date().toISOString(),
}));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/assets',       assetsRoutes);
app.use('/api/liabilities',  liabilitiesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/budgets',      budgetsRoutes);
app.use('/api/goals',        goalsRoutes);
app.use('/api/snapshots',    snapshotsRoutes);
app.use('/api/insights',     insightsRoutes);
app.use('/api',              strategyRoutes);
app.use('/api',              reportRoutes);   // /api/strategy-report, /api/decision

// ── Error handlers ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// Local dev entry point
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`\n  ₹  MyWealth OS running → http://localhost:${PORT}\n`));
}

// Vercel serverless export
module.exports = app;
