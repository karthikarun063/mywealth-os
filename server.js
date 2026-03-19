'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const dashboardRoutes    = require('./routes/dashboard');
const assetsRoutes       = require('./routes/assets');
const liabilitiesRoutes  = require('./routes/liabilities');
const transactionsRoutes = require('./routes/transactions');
const budgetsRoutes      = require('./routes/budgets');
const goalsRoutes        = require('./routes/goals');
const snapshotsRoutes    = require('./routes/snapshots');
const insightsRoutes     = require('./routes/insights');
const strategyRoutes     = require('./routes/strategy');
const reportRoutes       = require('./routes/report');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.options('*', cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// Health first
app.get('/api/health', (req, res) => res.json({
  status: 'ok', version: '2.1.0',
  db: !!process.env.DATABASE_URL,
  time: new Date().toISOString(),
}));

app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/assets',       assetsRoutes);
app.use('/api/liabilities',  liabilitiesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/budgets',      budgetsRoutes);
app.use('/api/goals',        goalsRoutes);
app.use('/api/snapshots',    snapshotsRoutes);
app.use('/api/insights',     insightsRoutes);
app.use('/api',              strategyRoutes);
app.use('/api',              reportRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n  ₹  MyWealth OS v2.1.0`);
  console.log(`  🟢 http://localhost:${PORT}`);
  console.log(`  📡 http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
