'use strict';
const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Category risk weights
const RISK = { stocks:8, mutual_funds:7, etf:7, crypto:10, bank_account:1, cash:1,
               fixed_deposit:2, epf:2, ppf:2, nps:4, gold:5, real_estate:5, vehicle:3,
               foreign_assets:7, others:5 };

router.get('/', async (req, res, next) => {
  const month = new Date().toISOString().slice(0,7);
  const prevM = (() => { const d = new Date(); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();

  try {
    const [assets, liabs, curTx, prevTx] = await Promise.all([
      db.query(`SELECT * FROM assets`),
      db.query(`SELECT * FROM liabilities`),
      db.query(`SELECT type,category,SUM(amount) AS total FROM transactions WHERE TO_CHAR(date,'YYYY-MM')=$1 GROUP BY type,category`, [month]),
      db.query(`SELECT type,category,SUM(amount) AS total FROM transactions WHERE TO_CHAR(date,'YYYY-MM')=$1 GROUP BY type,category`, [prevM]),
    ]);

    const curInc  = curTx.rows.filter(r=>r.type==='income').reduce((s,r)=>s+parseFloat(r.total),0);
    const curExp  = curTx.rows.filter(r=>r.type==='expense').reduce((s,r)=>s+parseFloat(r.total),0);
    const prevExp = prevTx.rows.filter(r=>r.type==='expense').reduce((s,r)=>s+parseFloat(r.total),0);
    const savingsRate = curInc > 0 ? ((curInc-curExp)/curInc)*100 : 0;

    const totalAssets = assets.rows.reduce((s,r)=>s+parseFloat(r.current_value),0);
    const totalDebt   = liabs.rows.reduce((s,r)=>s+parseFloat(r.outstanding_amount),0);
    const liquidAssets= assets.rows.filter(r=>['bank_account','cash','fixed_deposit'].includes(r.asset_class)).reduce((s,r)=>s+parseFloat(r.current_value),0);
    const dti         = curInc>0 ? (totalDebt/(curInc*12))*100 : 0;
    const efMonths    = curExp>0 ? liquidAssets/curExp : 0;
    const spendGrowth = prevExp>0 ? ((curExp-prevExp)/prevExp)*100 : 0;

    // Per-class allocation
    const byClass = {};
    assets.rows.forEach(a => { byClass[a.asset_class]=(byClass[a.asset_class]||0)+parseFloat(a.current_value); });
    const topClass    = Object.entries(byClass).sort(([,a],[,b])=>b-a)[0];
    const topClassPct = totalAssets > 0 ? (topClass?.[1]||0)/totalAssets*100 : 0;

    // Portfolio risk score
    const riskScore = Object.entries(byClass).reduce((s,[cls,val])=>{
      return s + ((val/totalAssets)*(RISK[cls]||5));
    }, 0);

    // Build insights
    const insights = [];
    const add = (type,severity,title,message,rec,metric='') =>
      insights.push({ type, severity, title, message, recommendation:rec, metric });

    // Savings rate
    const srClass = savingsRate>=40?'Excellent':savingsRate>=25?'Good':savingsRate>=10?'Average':'Poor';
    const srSev   = savingsRate>=25?'good':savingsRate>=10?'warning':'critical';
    add('savings',srSev,`Savings Rate: ${srClass}`,
      `Your savings rate is ${savingsRate.toFixed(1)}% this month (income ₹${(curInc/1000).toFixed(0)}K, expenses ₹${(curExp/1000).toFixed(0)}K).`,
      savingsRate>=25?'Great discipline — automate excess into SIPs.':'Cut discretionary spending to reach 25%+ savings.',
      `${savingsRate.toFixed(1)}%`);

    // Emergency fund
    const efSev = efMonths>=6?'good':efMonths>=3?'warning':'critical';
    add('emergency_fund',efSev,'Emergency Fund Coverage',
      `You have ${efMonths.toFixed(1)} months of expenses covered in liquid assets (₹${(liquidAssets/100000).toFixed(1)}L).`,
      efMonths>=6?'Emergency fund is solid.':'Build 6 months of expenses as liquid savings.',
      `${efMonths.toFixed(1)} months`);

    // Spending growth
    if (Math.abs(spendGrowth)>10) {
      add('spending',spendGrowth>20?'critical':'warning',
        spendGrowth>0?'Spending Surge Detected':'Spending Dropped',
        `Monthly expenses ${spendGrowth>0?'increased':'decreased'} by ${Math.abs(spendGrowth).toFixed(0)}% vs last month.`,
        spendGrowth>0?'Review top categories and set budget caps.':'Redirect savings to investments.',
        `${spendGrowth>0?'+':''}${spendGrowth.toFixed(0)}%`);
    }

    // Spending spikes by category
    const curExpMap  = Object.fromEntries(curTx.rows.filter(r=>r.type==='expense').map(r=>[r.category,parseFloat(r.total)]));
    const prevExpMap = Object.fromEntries(prevTx.rows.filter(r=>r.type==='expense').map(r=>[r.category,parseFloat(r.total)]));
    Object.entries(curExpMap).forEach(([cat,cur]) => {
      const prev = prevExpMap[cat]||0;
      const ch   = prev>0?((cur-prev)/prev)*100:0;
      if (ch>30) add('spending','warning',`${cat.charAt(0).toUpperCase()+cat.slice(1)} Spike`,
        `${cat} spending jumped ${ch.toFixed(0)}% (₹${(prev/1000).toFixed(0)}K → ₹${(cur/1000).toFixed(0)}K).`,
        `Set a monthly cap for ${cat} in Budget Planner.`,`+${ch.toFixed(0)}%`);
    });

    // DTI
    const dtiSev = dti<20?'good':dti<35?'warning':'critical';
    add('debt_risk',dtiSev,`Debt Risk: ${dti<20?'Low':dti<35?'Moderate':'High'}`,
      `Debt-to-income ratio is ${dti.toFixed(0)}%. Total outstanding: ₹${(totalDebt/100000).toFixed(1)}L.`,
      dti<20?'Low debt — consider investing surplus.':'Prioritise paying off high-interest debt.',
      `DTI ${dti.toFixed(0)}%`);

    // Concentration
    if (topClassPct>60) {
      add('diversification','warning','Portfolio Concentration Risk',
        `${topClass[0].replace('_',' ')} accounts for ${topClassPct.toFixed(0)}% of your portfolio. High concentration amplifies risk.`,
        'Spread across 5+ asset classes. No single class should exceed 50%.',
        `${topClassPct.toFixed(0)}%`);
    }

    // Risk score summary
    const riskLabel = riskScore>7?'Very High':riskScore>5?'High':riskScore>3?'Moderate':'Low';
    add('diversification',riskScore>7?'warning':'info',`Portfolio Risk Score: ${riskLabel}`,
      `Weighted portfolio risk score is ${riskScore.toFixed(1)}/10 based on asset class volatility.`,
      riskScore>6?'Add debt/gold to reduce overall portfolio volatility.':'Risk profile looks balanced.',
      `${riskScore.toFixed(1)}/10`);

    insights.sort((a,b)=>{const o={critical:0,warning:1,info:2,good:3};return o[a.severity]-o[b.severity];});

    res.json({
      insights,
      metrics: {
        savingsRate, srClass, curInc, curExp,
        efMonths, liquidAssets, dti,
        totalAssets, totalDebt, riskScore, spendGrowth,
        topClass: topClass?.[0], topClassPct,
        criticalCount: insights.filter(i=>i.severity==='critical').length,
        warningCount:  insights.filter(i=>i.severity==='warning').length,
        goodCount:     insights.filter(i=>i.severity==='good').length,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
