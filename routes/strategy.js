'use strict';
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/connection');

const router = express.Router();

// ════════════════════════════════════════════════════════════════
//  RULE ENGINE — pure functions, no external deps
// ════════════════════════════════════════════════════════════════

/** Emergency fund: liquid / monthly_expenses */
function efMonths(liquidAssets, monthlyExpenses) {
  if (!monthlyExpenses) return 0;
  return liquidAssets / monthlyExpenses;
}

function efStatus(months) {
  if (months < 3)  return { label: 'CRITICAL', color: 'danger',  score: 0  };
  if (months < 6)  return { label: 'WARNING',  color: 'warning', score: 50 };
  return              { label: 'GOOD',     color: 'success', score: 100 };
}

/** Debt ratio: total_debt / annual_income */
function debtRatio(totalDebt, annualIncome) {
  if (!annualIncome) return 0;
  return (totalDebt / annualIncome) * 100;
}

function debtStatus(ratio) {
  if (ratio > 35) return { label: 'HIGH RISK', color: 'danger',  score: 0  };
  if (ratio > 20) return { label: 'MODERATE',  color: 'warning', score: 50 };
  return            { label: 'SAFE',      color: 'success', score: 100 };
}

/** Savings rate: (income - expense) / income */
function savingsRate(income, expense) {
  if (!income) return 0;
  return ((income - expense) / income) * 100;
}

function savingsStatus(rate) {
  if (rate < 10) return { label: 'LOW',     color: 'danger',  score: 0  };
  if (rate < 20) return { label: 'AVERAGE', color: 'warning', score: 50 };
  return           { label: 'STRONG',  color: 'success', score: 100 };
}

/** Portfolio concentration: max single class % */
function maxConcentration(byClass, totalAssets) {
  if (!totalAssets) return 0;
  const max = Math.max(...Object.values(byClass));
  return (max / totalAssets) * 100;
}

function concentrationStatus(pct) {
  if (pct > 60) return { label: 'HIGH RISK', color: 'danger',  score: 0  };
  if (pct > 40) return { label: 'MODERATE',  color: 'warning', score: 50 };
  return          { label: 'GOOD',      color: 'success', score: 100 };
}

/**
 * Compute overall score 0–100 from 4 components (weighted).
 * EF 30% | Debt 25% | Savings 25% | Concentration 20%
 */
function computeScore(efS, debtS, savS, concS) {
  return Math.round(
    efS   * 0.30 +
    debtS * 0.25 +
    savS  * 0.25 +
    concS * 0.20
  );
}

function scoreToRisk(score) {
  if (score >= 75) return 'Low';
  if (score >= 50) return 'Moderate';
  if (score >= 25) return 'High';
  return 'Critical';
}

/** Build ordered list of risks from component statuses */
function buildTopRisks(ef, debt, sav, conc, efMos, debtRat, savRat, concPct) {
  const risks = [];
  if (ef.label   === 'CRITICAL') risks.push(`Emergency fund critically low (${efMos.toFixed(1)} months)`);
  if (debt.label === 'HIGH RISK') risks.push(`High debt-to-income ratio (${debtRat.toFixed(0)}%)`);
  if (sav.label  === 'LOW')       risks.push(`Low savings rate (${savRat.toFixed(1)}%)`);
  if (ef.label   === 'WARNING')   risks.push(`Emergency fund below 6 months (${efMos.toFixed(1)} months)`);
  if (debt.label === 'MODERATE')  risks.push(`Moderate debt burden (${debtRat.toFixed(0)}%)`);
  if (sav.label  === 'AVERAGE')   risks.push(`Savings rate could be stronger (${savRat.toFixed(1)}%)`);
  if (conc.label !== 'GOOD')      risks.push(`Portfolio concentration risk (${concPct.toFixed(0)}% in one class)`);
  return risks.slice(0, 5);
}

/** Build prioritised action plan from component statuses */
function buildActions(ef, debt, sav, conc, efMos, monthlyExpenses, monthlyIncome, totalDebt) {
  const actions = [];
  let p = 1;

  if (ef.label === 'CRITICAL') {
    const target   = monthlyExpenses * 4;
    actions.push({
      priority: p++,
      action:   `Build emergency fund to 4 months (target: ₹${Math.round(target).toLocaleString('en-IN')})`,
      impact:   'Eliminates financial vulnerability in emergencies',
      urgency:  'Immediate',
    });
  }
  if (debt.label === 'HIGH RISK') {
    actions.push({
      priority: p++,
      action:   'Accelerate high-interest debt repayment (avalanche method)',
      impact:   'Reduces interest burden and improves cash flow',
      urgency:  'Immediate',
    });
  }
  if (sav.label === 'LOW') {
    actions.push({
      priority: p++,
      action:   'Reduce monthly expenses by 10–15% to improve savings rate',
      impact:   'Improves savings rate from critical to average',
      urgency:  'This month',
    });
  }
  if (ef.label === 'WARNING') {
    actions.push({
      priority: p++,
      action:   `Increase emergency fund to 6 months (add ₹${Math.round(monthlyExpenses * (6 - ef.months || 4)).toLocaleString('en-IN')})`,
      impact:   'Reaches the safety threshold for financial stability',
      urgency:  '30–60 days',
    });
  }
  if (sav.label === 'AVERAGE') {
    const sipBoost = Math.round(monthlyIncome * 0.05);
    actions.push({
      priority: p++,
      action:   `Increase SIP by ₹${sipBoost.toLocaleString('en-IN')} to push savings rate above 20%`,
      impact:   'Builds long-term wealth significantly faster',
      urgency:  '30 days',
    });
  }
  if (conc.label !== 'GOOD') {
    actions.push({
      priority: p++,
      action:   'Diversify portfolio — add debt instruments or gold to reduce concentration',
      impact:   'Reduces portfolio volatility and drawdown risk',
      urgency:  '60–90 days',
    });
  }
  if (debt.label === 'MODERATE') {
    actions.push({
      priority: p++,
      action:   'Avoid taking new loans until debt ratio drops below 20%',
      impact:   'Prevents further debt accumulation',
      urgency:  '90 days',
    });
  }
  // Always recommend this
  actions.push({
    priority: p++,
    action:   'Automate savings — set up auto-transfer on salary day',
    impact:   'Makes saving effortless and consistent',
    urgency:  'This week',
  });

  return actions.slice(0, 5);
}

function buildNext30(ef, sav, debt) {
  const steps = ['Track every expense — use the Cash Flow tab daily'];
  if (sav.label === 'LOW' || sav.label === 'AVERAGE') {
    steps.push('Identify and cut top 2 discretionary spending categories');
  }
  if (ef.label === 'CRITICAL' || ef.label === 'WARNING') {
    steps.push('Move ₹5,000–10,000 into a liquid savings account this week');
  }
  if (debt.label === 'HIGH RISK') {
    steps.push('List all debts by interest rate — pay minimum on all, extra on highest rate');
  }
  steps.push('Review all recurring subscriptions — cancel unused ones');
  steps.push('Set up a monthly budget in the Budget Planner');
  return steps.slice(0, 5);
}

function buildNext90(ef, sav, debt) {
  const steps = [];
  if (ef.label !== 'GOOD') steps.push('Reach 3–6 months emergency fund coverage');
  if (sav.label !== 'STRONG') steps.push('Improve savings rate to 20%+');
  if (debt.label !== 'SAFE') steps.push('Reduce total debt by at least 10%');
  steps.push('Rebalance portfolio to reduce any asset class above 50%');
  steps.push('Review all financial goals and adjust SIP amounts');
  return steps.slice(0, 5);
}

// ════════════════════════════════════════════════════════════════
//  GET /api/strategy-report
// ════════════════════════════════════════════════════════════════

router.get('/strategy-report', async (req, res, next) => {
  const userId = req.query.user_id || 'default';

  try {
    // Fetch all data in parallel
    const [assetsRes, liabsRes, txRes, goalsRes] = await Promise.all([
      db.query(`SELECT asset_class, current_value, purchase_value FROM assets`),
      db.query(`SELECT outstanding_amount, interest_rate, emi FROM liabilities`),
      db.query(`
        SELECT type, SUM(amount) AS total
        FROM transactions
        WHERE date >= date_trunc('month', CURRENT_DATE)
        GROUP BY type
      `),
      db.query(`SELECT goal_name, target_amount, current_amount, monthly_contribution FROM goals`),
    ]);

    // ── Derived values ─────────────────────────────────────────────────────
    const totalAssets = assetsRes.rows.reduce((s, r) => s + +r.current_value, 0);
    const totalPurchase = assetsRes.rows.reduce((s, r) => s + +r.purchase_value, 0);
    const totalDebt   = liabsRes.rows.reduce((s, r) => s + +r.outstanding_amount, 0);
    const totalEMI    = liabsRes.rows.reduce((s, r) => s + +r.emi, 0);

    const txMap = Object.fromEntries(txRes.rows.map(r => [r.type, +r.total]));
    const monthlyIncome  = txMap['income']  || 0;
    const monthlyExpense = txMap['expense'] || 0;
    const annualIncome   = monthlyIncome * 12;

    // Liquid assets (bank, cash, FD)
    const liquidAssets = assetsRes.rows
      .filter(r => ['bank_account','cash','fixed_deposit'].includes(r.asset_class))
      .reduce((s, r) => s + +r.current_value, 0);

    // Portfolio by class
    const byClass = {};
    assetsRes.rows.forEach(r => {
      byClass[r.asset_class] = (byClass[r.asset_class] || 0) + +r.current_value;
    });

    // ── Rule engine ────────────────────────────────────────────────────────
    const efMos   = efMonths(liquidAssets, monthlyExpense);
    const debtRat = debtRatio(totalDebt, annualIncome);
    const savRat  = savingsRate(monthlyIncome, monthlyExpense);
    const concPct = maxConcentration(byClass, totalAssets);

    const efSt   = { ...efStatus(efMos),   months: efMos   };
    const debtSt = { ...debtStatus(debtRat), ratio: debtRat };
    const savSt  = { ...savingsStatus(savRat), rate: savRat };
    const concSt = { ...concentrationStatus(concPct), pct: concPct };

    const score    = computeScore(efSt.score, debtSt.score, savSt.score, concSt.score);
    const riskLevel = scoreToRisk(score);

    // ── Build output ───────────────────────────────────────────────────────
    const topRisks          = buildTopRisks(efSt, debtSt, savSt, concSt, efMos, debtRat, savRat, concPct);
    const recommendedActions = buildActions(efSt, debtSt, savSt, concSt, efMos, monthlyExpense, monthlyIncome, totalDebt);
    const next30Days        = buildNext30(efSt, savSt, debtSt);
    const next90Days        = buildNext90(efSt, savSt, debtSt);

    const report = {
      score,
      risk_level: riskLevel,
      generated_at: new Date().toISOString(),
      metrics: {
        emergency_fund_months:  +efMos.toFixed(2),
        emergency_fund_status:  efSt.label,
        debt_ratio_pct:         +debtRat.toFixed(2),
        debt_status:            debtSt.label,
        savings_rate_pct:       +savRat.toFixed(2),
        savings_status:         savSt.label,
        portfolio_concentration_pct: +concPct.toFixed(2),
        concentration_status:   concSt.label,
        total_assets:           totalAssets,
        total_debt:             totalDebt,
        monthly_income:         monthlyIncome,
        monthly_expense:        monthlyExpense,
        liquid_assets:          liquidAssets,
        total_emi:              totalEMI,
        unrealised_gain:        totalAssets - totalPurchase,
      },
      top_risks: topRisks,
      recommended_actions: recommendedActions,
      next_30_days: next30Days,
      next_90_days: next90Days,
      goals_summary: goalsRes.rows.map(g => ({
        name:       g.goal_name,
        progress:   totalAssets > 0 ? +((+g.current_amount / +g.target_amount) * 100).toFixed(1) : 0,
        on_track:   +g.current_amount + (+g.monthly_contribution * 12 * 5) >= +g.target_amount,
      })),
    };

    // Persist to financial_reports (best-effort, don't fail request if it errors)
    db.query(
      `INSERT INTO financial_reports(user_id, score, risk_level, summary)
       VALUES($1,$2,$3,$4)`,
      [userId, score, riskLevel, JSON.stringify(report)]
    ).catch(() => {});

    res.json(report);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  POST /api/decision  — Decision Simulator
// ════════════════════════════════════════════════════════════════

router.post('/decision', [
  body('type').isIn(['buy_car','buy_house','increase_sip','take_loan','invest_lump_sum']),
  body('amount').isFloat({ min: 1 }),
  body('interest_rate').optional().isFloat({ min: 0, max: 100 }),
  body('tenure_months').optional().isInt({ min: 1, max: 600 }),
  body('sip_change').optional().isFloat(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { type, amount, interest_rate = 0, tenure_months = 60, sip_change = 0 } = req.body;

  try {
    // Current state
    const [txRes, assetsRes, liabsRes] = await Promise.all([
      db.query(`
        SELECT type, SUM(amount) AS total FROM transactions
        WHERE date >= date_trunc('month', CURRENT_DATE) GROUP BY type
      `),
      db.query(`SELECT SUM(current_value) AS total FROM assets`),
      db.query(`SELECT SUM(outstanding_amount) AS total, SUM(emi) AS emi FROM liabilities`),
    ]);

    const txMap  = Object.fromEntries((txRes.rows || []).map(r => [r.type, +r.total]));
    const income  = txMap['income']  || 0;
    const expense = txMap['expense'] || 0;
    const currentSavingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
    const totalAssets = +(assetsRes.rows[0]?.total || 0);
    const totalDebt   = +(liabsRes.rows[0]?.total  || 0);
    const currentEMI  = +(liabsRes.rows[0]?.emi    || 0);

    // Compute EMI for loan-based decisions
    let newEMI = 0;
    if (['buy_car','buy_house','take_loan'].includes(type) && interest_rate > 0) {
      const r   = interest_rate / 100 / 12;
      const n   = tenure_months;
      newEMI    = Math.round(amount * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1));
    } else if (['buy_car','buy_house','take_loan'].includes(type)) {
      newEMI = Math.round(amount / tenure_months); // simple division fallback
    }

    // After-state
    let newExpense  = expense;
    let newAssets   = totalAssets;
    let newDebt     = totalDebt;
    let newIncome   = income;
    let newSIPBoost = sip_change;

    if (['buy_car','buy_house','take_loan'].includes(type)) {
      newExpense += newEMI;
      newDebt    += amount;
    }
    if (type === 'increase_sip') {
      newExpense += sip_change;
      newAssets  += sip_change * 12 * 10; // rough 10-yr SIP impact
    }
    if (type === 'invest_lump_sum') {
      newAssets += amount * 1.5; // rough 5-yr 8% CAGR
      newExpense += 0;
    }

    const newSavingsRate = newIncome > 0 ? ((newIncome - newExpense) / newIncome) * 100 : 0;
    const netWorthChange = newAssets - newDebt - (totalAssets - totalDebt);
    const savingsRateDelta = newSavingsRate - currentSavingsRate;

    // Risk assessment
    let risk = 'low';
    if (savingsRateDelta < -10 || newExpense / (income || 1) > 0.85) risk = 'high';
    else if (savingsRateDelta < -5) risk = 'moderate';

    // Recommendation text
    const recs = {
      buy_car: newEMI > income * 0.15
        ? `The EMI of ₹${newEMI.toLocaleString('en-IN')}/month is ${((newEMI/income)*100).toFixed(0)}% of income — above the 15% safe threshold. Consider a smaller loan or larger down payment.`
        : `This is manageable. EMI of ₹${newEMI.toLocaleString('en-IN')}/month is within the 15% income guideline.`,
      buy_house: newEMI > income * 0.40
        ? `Home EMI of ₹${newEMI.toLocaleString('en-IN')}/month exceeds 40% of income. This is high — consider a longer tenure or higher down payment.`
        : `Home loan EMI of ₹${newEMI.toLocaleString('en-IN')}/month is within sustainable limits.`,
      take_loan: savingsRateDelta < -8
        ? `This loan reduces your savings rate by ${Math.abs(savingsRateDelta).toFixed(1)}%. Only take it if absolutely necessary.`
        : `Loan is manageable but monitor your cash flow carefully.`,
      increase_sip: `Increasing SIP by ₹${sip_change.toLocaleString('en-IN')}/month could grow your portfolio by ₹${(sip_change*12*10*1.2).toLocaleString('en-IN')} over 10 years. Excellent long-term move.`,
      invest_lump_sum: `Investing ₹${(+amount).toLocaleString('en-IN')} as a lump sum can significantly boost your net worth. Ensure you maintain your emergency fund before doing this.`,
    };

    res.json({
      decision: { type, amount: +amount, interest_rate, tenure_months, new_emi: newEMI },
      impact: {
        savings_rate_before:  +currentSavingsRate.toFixed(2),
        savings_rate_after:   +newSavingsRate.toFixed(2),
        savings_rate_change:  +savingsRateDelta.toFixed(2),
        net_worth_change:     Math.round(netWorthChange),
        monthly_emi_added:    newEMI,
        total_emi_after:      currentEMI + newEMI,
        risk,
      },
      recommendation: recs[type] || 'Evaluate this decision carefully against your financial goals.',
      proceed: risk !== 'high',
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  GET /api/decision/history  — past reports
// ════════════════════════════════════════════════════════════════

router.get('/reports', async (req, res, next) => {
  const userId = req.query.user_id || 'default';
  try {
    const { rows } = await db.query(
      `SELECT id, score, risk_level, created_at FROM financial_reports
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
