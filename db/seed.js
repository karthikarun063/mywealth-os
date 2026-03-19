'use strict';
require('dotenv').config();
const { pool, query } = require('./connection');

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; };

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear all tables in safe order
    for (const t of ['snapshots','goals','budgets','transactions','liabilities','assets']) {
      await client.query(`DELETE FROM ${t}`);
    }
    console.log('✓  Cleared existing data.');

    // ── Assets ──────────────────────────────────────────────────────────
    const assets = [
      ['HDFC Flexi Cap Fund',   'mutual_funds', 1,   250000, 310000, 'SIP ₹5K/mo'],
      ['Reliance Industries',   'stocks',       50,  120000, 145000, '50 shares'],
      ['HDFC Bank Savings A/C', 'bank_account', 1,   85000,  85000,  ''],
      ['Nifty 50 ETF',          'etf',          200, 180000, 225000, '200 units'],
      ['Employee PF',           'epf',          1,   320000, 380000, 'Auto-deducted'],
      ['PPF Account',           'ppf',          1,   200000, 240000, '15yr lock-in'],
      ['Sovereign Gold Bond',   'gold',         10,  48000,  62000,  '10g equiv'],
      ['Bitcoin',               'crypto',       0.05,150000, 195000, '0.05 BTC'],
      ['SBI Fixed Deposit',     'fixed_deposit',1,   100000, 107000, '7% p.a. 1yr'],
    ];
    for (const [name,cls,qty,pv,cv,notes] of assets) {
      await client.query(
        `INSERT INTO assets(name,asset_class,quantity,purchase_value,current_value,notes)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [name,cls,qty,pv,cv,notes]
      );
    }
    console.log('✓  Assets seeded.');

    // ── Liabilities ──────────────────────────────────────────────────────
    const liabs = [
      ['Home Loan — SBI',  'home_loan',   2800000, 8.5,  28000, 'SBI Bank'],
      ['Car Loan — HDFC',  'car_loan',    350000,  9.2,  8500,  'HDFC Bank'],
      ['HDFC Credit Card', 'credit_card', 45000,   36,   45000, 'HDFC Bank'],
    ];
    for (const [name,type,amt,rate,emi,lender] of liabs) {
      await client.query(
        `INSERT INTO liabilities(name,liability_type,outstanding_amount,interest_rate,emi,lender)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [name,type,amt,rate,emi,lender]
      );
    }
    console.log('✓  Liabilities seeded.');

    // ── Transactions ─────────────────────────────────────────────────────
    const txns = [
      ['income',  'salary',        120000, daysAgo(1),  false],
      ['income',  'freelance',     25000,  daysAgo(5),  false],
      ['income',  'dividends',     3500,   daysAgo(10), false],
      ['income',  'salary',        120000, daysAgo(31), false],
      ['income',  'salary',        120000, daysAgo(62), false],
      ['expense', 'rent',          28000,  daysAgo(2),  true],
      ['expense', 'groceries',     8500,   daysAgo(3),  false],
      ['expense', 'transport',     4200,   daysAgo(4),  false],
      ['expense', 'utilities',     3200,   daysAgo(6),  true],
      ['expense', 'entertainment', 2800,   daysAgo(8),  false],
      ['expense', 'investments',   15000,  daysAgo(9),  true],
      ['expense', 'medical',       1800,   daysAgo(12), false],
      ['expense', 'shopping',      5500,   daysAgo(14), false],
      ['expense', 'rent',          28000,  daysAgo(33), true],
      ['expense', 'groceries',     9200,   daysAgo(36), false],
      ['expense', 'travel',        18000,  daysAgo(40), false],
      ['expense', 'dining',        3200,   daysAgo(7),  false],
      ['expense', 'food',          4500,   daysAgo(5),  false],
    ];
    for (const [type,cat,amt,date,rec] of txns) {
      await client.query(
        `INSERT INTO transactions(type,category,amount,date,recurring)
         VALUES($1,$2,$3,$4,$5)`,
        [type,cat,amt,date,rec]
      );
    }
    console.log('✓  Transactions seeded.');

    // ── Budgets (new schema: month=SMALLINT, year=SMALLINT) ───────────────
    const now      = new Date();
    const curMonth = now.getMonth() + 1;   // 1-12
    const curYear  = now.getFullYear();
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    const prevYear  = curMonth === 1 ? curYear - 1 : curYear;

    const budgetData = [
      ['rent',          28000],
      ['groceries',     12000],
      ['transport',     5000],
      ['utilities',     4000],
      ['entertainment', 3500],
      ['medical',       3000],
      ['shopping',      8000],
      ['investments',   20000],
      ['food',          6000],
      ['dining',        4000],
    ];
    for (const [cat, amt] of budgetData) {
      // Current month
      await client.query(
        `INSERT INTO budgets(user_id,category,monthly_budget,month,year)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(user_id,category,month,year) DO NOTHING`,
        ['default', cat, amt, curMonth, curYear]
      );
      // Previous month
      await client.query(
        `INSERT INTO budgets(user_id,category,monthly_budget,month,year)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(user_id,category,month,year) DO NOTHING`,
        ['default', cat, Math.round(amt * 0.95), prevMonth, prevYear]
      );
    }
    console.log('✓  Budgets seeded.');

    // ── Goals ────────────────────────────────────────────────────────────
    const goals = [
      ['Emergency Fund',     'emergency_fund', 600000,   85000,  10000, '2026-06-01', 6],
      ['Retirement Corpus',  'retirement',     30000000, 1000000,20000, '2050-01-01', 12],
      ['House Down Payment', 'house',          2000000,  450000, 25000, '2028-01-01', 10],
      ['Europe Vacation',    'travel',         300000,   80000,  8000,  '2026-12-01', 6],
    ];
    for (const [name,type,tgt,cur,sip,date,ret] of goals) {
      await client.query(
        `INSERT INTO goals(goal_name,goal_type,target_amount,current_amount,
          monthly_contribution,target_date,expected_return)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [name,type,tgt,cur,sip,date,ret]
      );
    }
    console.log('✓  Goals seeded.');

    // ── Snapshots (12 months history) ─────────────────────────────────────
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mo = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const a  = 1300000 + (11-i) * 80000;
      const l  = 3200000 - (11-i) * 15000;
      const sr = 28 + (11-i) * 0.5;
      await client.query(
        `INSERT INTO snapshots(month,total_assets,total_liabilities,net_worth,savings_rate)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(month) DO NOTHING`,
        [mo, a, l, a-l, sr.toFixed(2)]
      );
    }
    console.log('✓  Snapshots seeded.');

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✕  Seed error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
