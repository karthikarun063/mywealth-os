'use strict';
const express            = require('express');
const db                 = require('../db/connection');
const { generateAIGuidance } = require('../utils/aiReport');
const { generatePDF }    = require('../utils/pdfReport');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  const abs = Math.abs(+n || 0);
  if (abs >= 1e7) return `${(abs/1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(abs/1e5).toFixed(1)} L`;
  if (abs >= 1e3) return `${(abs/1e3).toFixed(1)} K`;
  return `${Math.round(abs)}`;
}

function scoreColor(score) {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

function scoreToRisk(score) {
  if (score >= 75) return 'Low';
  if (score >= 50) return 'Moderate';
  if (score >= 25) return 'High';
  return 'Critical';
}

function scoreDescription(score) {
  if (score >= 75) return 'Your finances are in strong shape. Keep maintaining these good habits.';
  if (score >= 50) return 'Your finances are moderate. Some key areas need attention to strengthen your position.';
  if (score >= 25) return 'Your finances need significant improvement. Follow the action plan below.';
  return 'Critical financial risks detected. Immediate action is required.';
}

// ── Core data computation (reused by both routes) ─────────────────────────────

async function computeReportData() {
  const [assetsRes, liabsRes, txRes, goalsRes, snapsRes] = await Promise.all([
    db.query(`SELECT asset_class, current_value, purchase_value FROM assets`),
    db.query(`SELECT outstanding_amount, interest_rate, emi FROM liabilities`),
    db.query(`
      SELECT type, SUM(amount) AS total
      FROM transactions
      WHERE date >= date_trunc('month', CURRENT_DATE)
      GROUP BY type
    `),
    db.query(`SELECT goal_name, target_amount, current_amount, monthly_contribution FROM goals`),
    db.query(`SELECT month, net_worth, total_assets FROM snapshots ORDER BY month ASC LIMIT 12`),
  ]);

  // Raw numbers
  const totalAssets      = assetsRes.rows.reduce((s,r) => s + +r.current_value, 0);
  const totalPurchase    = assetsRes.rows.reduce((s,r) => s + +r.purchase_value, 0);
  const totalLiabilities = liabsRes.rows.reduce((s,r) => s + +r.outstanding_amount, 0);
  const totalEMI         = liabsRes.rows.reduce((s,r) => s + +r.emi, 0);
  const netWorth         = totalAssets - totalLiabilities;

  const txMap        = Object.fromEntries(txRes.rows.map(r => [r.type, +r.total]));
  const monthlyIncome  = txMap['income']  || 0;
  const monthlyExpense = txMap['expense'] || 0;
  const savingsRate    = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

  const liquidAssets = assetsRes.rows
    .filter(r => ['bank_account','cash','fixed_deposit'].includes(r.asset_class))
    .reduce((s,r) => s + +r.current_value, 0);

  const efMonths  = monthlyExpense > 0 ? liquidAssets / monthlyExpense : 0;
  const dtiRatio  = (monthlyIncome * 12) > 0 ? (totalLiabilities / (monthlyIncome * 12)) * 100 : 0;

  // Asset class breakdown
  const byClass = {};
  assetsRes.rows.forEach(r => {
    byClass[r.asset_class] = (byClass[r.asset_class] || 0) + +r.current_value;
  });
  const topAsset       = Object.entries(byClass).sort(([,a],[,b]) => b-a)[0];
  const topAssetClass  = topAsset ? topAsset[0].replace(/_/g,' ') : '—';
  const topAssetPct    = topAsset && totalAssets > 0 ? (topAsset[1]/totalAssets*100) : 0;

  // Score
  const efScore     = Math.min(100, (efMonths/6)*100);
  const debtScore   = Math.max(0, 100-(dtiRatio/50)*100);
  const savScore    = Math.min(100, (savingsRate/40)*100);
  const concScore   = topAssetPct > 60 ? 40 : topAssetPct > 40 ? 70 : 100;
  const score       = Math.round(efScore*0.30 + debtScore*0.25 + savScore*0.25 + concScore*0.20);
  const riskLevel   = scoreToRisk(score);

  // Top risks
  const topRisks = [];
  if (efMonths  < 3)  topRisks.push(`Emergency fund critically low — only ${efMonths.toFixed(1)} months covered`);
  if (dtiRatio  > 35) topRisks.push(`High debt-to-income ratio at ${dtiRatio.toFixed(0)}%`);
  if (savingsRate < 10) topRisks.push(`Low savings rate of ${savingsRate.toFixed(1)}% (target: 20%+)`);
  if (efMonths  < 6 && efMonths >= 3) topRisks.push(`Emergency fund below 6-month target (${efMonths.toFixed(1)} months)`);
  if (topAssetPct > 60) topRisks.push(`Portfolio over-concentrated in ${topAssetClass} (${topAssetPct.toFixed(0)}%)`);
  if (dtiRatio > 20 && dtiRatio <= 35) topRisks.push(`Moderate debt burden at ${dtiRatio.toFixed(0)}%`);

  // Action plans
  const next30Days = [
    'Track every expense daily using the Cash Flow tab',
    ...(savingsRate < 20 ? ['Cut top 2 discretionary categories by 10%'] : []),
    ...(efMonths < 6 ? [`Add ₹${fmt(monthlyExpense * 0.5)} to liquid savings this month`] : []),
    'Review and cancel unused subscriptions',
    'Set up auto-transfer of savings on salary day',
  ].slice(0, 5);

  const next90Days = [
    ...(efMonths < 6 ? ['Reach 6-month emergency fund target'] : []),
    ...(savingsRate < 20 ? ['Improve savings rate to 20%+'] : []),
    ...(dtiRatio > 20 ? ['Reduce total debt by at least 10%'] : []),
    'Rebalance portfolio — no single class above 50%',
    'Review all financial goals and increase SIP amounts',
  ].slice(0, 5);

  // Chart data
  const snapshotChart = snapsRes.rows.map(s => ({
    month:     s.month,
    net_worth: +s.net_worth,
    assets:    +s.total_assets,
  }));

  const assetAllocation = Object.entries(byClass)
    .map(([asset_class, value]) => ({ asset_class, value }))
    .sort((a,b) => b.value - a.value);

  // Summary for AI
  const summary = {
    totalAssets, totalLiabilities, netWorth,
    monthlyIncome, monthlyExpense, savingsRate,
    efMonths, dtiRatio, topAssetClass, score,
  };

  return {
    score,
    riskLevel,
    scoreDescription: scoreDescription(score),
    generatedAt: new Date().toISOString(),
    metrics: {
      totalAssets, totalLiabilities, netWorth,
      monthlyIncome, monthlyExpense, savingsRate,
      efMonths, dtiRatio, totalEMI, liquidAssets,
      unrealisedGain: totalAssets - totalPurchase,
      topAssetClass, topAssetPct,
    },
    topRisks,
    next30Days,
    next90Days,
    goals:           goalsRes.rows,
    snapshotChart,
    assetAllocation,
    summary,   // for AI prompt
  };
}

// ── GET /api/report-data ──────────────────────────────────────────────────────
// Returns full structured report including AI guidance.
router.get('/report-data', async (req, res, next) => {
  try {
    const data      = await computeReportData();
    const aiGuidance = await generateAIGuidance(data.summary);

    res.json({ ...data, aiGuidance });
  } catch (err) { next(err); }
});

// ── GET /api/report-pdf ───────────────────────────────────────────────────────
// Generates and returns a downloadable PDF.
router.get('/report-pdf', async (req, res, next) => {
  try {
    const data       = await computeReportData();
    const aiGuidance = await generateAIGuidance(data.summary);
    const reportData = { ...data, aiGuidance };

    const pdf = await generatePDF(reportData);

    const filename = `mywealth-report-${new Date().toISOString().slice(0,10)}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdf.length,
    });
    res.send(pdf);
  } catch (err) { next(err); }
});

module.exports = router;
