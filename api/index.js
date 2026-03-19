'use strict';
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const morgan    = require('morgan');

const { errorHandler, notFound } = require('../middleware/errorHandler');
const dashboardRoutes    = require('../routes/dashboard');
const assetsRoutes       = require('../routes/assets');
const liabilitiesRoutes  = require('../routes/liabilities');
const transactionsRoutes = require('../routes/transactions');
const budgetsRoutes      = require('../routes/budgets');
const goalsRoutes        = require('../routes/goals');
const snapshotsRoutes    = require('../routes/snapshots');
const insightsRoutes     = require('../routes/insights');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// API routes
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/assets',       assetsRoutes);
app.use('/api/liabilities',  liabilitiesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/budgets',      budgetsRoutes);
app.use('/api/goals',        goalsRoutes);
app.use('/api/snapshots',    snapshotsRoutes);
app.use('/api/insights',     insightsRoutes);

app.get('/api/health', (req, res) => res.json({
  status:  'ok',
  version: '2.0.0',
  time:    new Date().toISOString(),
  env:     process.env.NODE_ENV || 'development',
}));

app.use(notFound);
app.use(errorHandler);

// For local dev: node api/index.js
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

// For Vercel: export the Express app as a serverless function
module.exports = app;
