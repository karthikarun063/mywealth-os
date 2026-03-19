'use strict';
Router.register('dashboard', async () => {
  const c = document.getElementById('page-container');
  c.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Dashboard</h1><p class="page-sub">Your wealth at a glance</p></div>
    </div>

    <!-- KPI row -->
    <div class="grid-4" id="dash-kpis" style="margin-bottom:14px">
      ${Array(4).fill(`<div class="stat-card"><div style="height:50px;background:var(--bg3);border-radius:8px;animation:pulse 1.5s infinite"></div></div>`).join('')}
    </div>

    <!-- Charts row 1 -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px">
      <div class="card">
        <div class="section-title">Net Worth Trend</div>
        <div class="chart-wrap" style="height:200px"><canvas id="nw-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="section-title">Asset Allocation</div>
        <div class="chart-wrap" style="height:200px"><canvas id="alloc-chart"></canvas></div>
      </div>
    </div>

    <!-- Charts row 2 -->
    <div class="grid-2" style="margin-bottom:12px">
      <div class="card">
        <div class="section-title">Income vs Expenses (6 months)</div>
        <div class="chart-wrap" style="height:180px"><canvas id="cashflow-chart"></canvas></div>
      </div>
      <div class="card" id="top-exp-card">
        <div class="section-title">Top Expenses This Month</div>
        <div class="chart-wrap" style="height:180px"><canvas id="top-exp-chart"></canvas></div>
      </div>
    </div>

    <!-- Budget Status card -->
    <div class="card" id="budget-status-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="section-title" style="margin-bottom:0">📊 Budget Status</div>
        <button class="btn btn-ghost btn-sm" onclick="Router.go('budget')" style="font-size:11px">View All →</button>
      </div>
      <div id="budget-status-content" style="display:flex;align-items:center;justify-content:center;min-height:60px">
        <span style="color:var(--text3);font-size:13px">Loading budget status…</span>
      </div>
    </div>
  `;

  try {
    const [dash, snaps, monthly, cats] = await Promise.all([
      API.dashboard(),
      API.snapshots(),
      API.txMonthlySummary(),
      API.txCategoryTotals(currentMonth()),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────
    const nw = +dash.netWorth;
    const sr = +dash.savingsRate;
    document.getElementById('dash-kpis').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Net Worth</div>
        <div class="stat-val c-violet mono">${inr(nw)}</div>
        <div class="stat-sub">Assets − Liabilities</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Assets</div>
        <div class="stat-val c-green mono">${inr(dash.totalAssets)}</div>
        <div class="stat-sub">${dash.byClass.length} asset classes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Liabilities</div>
        <div class="stat-val c-red mono">${inr(dash.totalLiabilities)}</div>
        <div class="stat-sub">EMI: ${inr(dash.totalEMI)}/mo</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Savings Rate</div>
        <div class="stat-val ${sr>=20?'c-green':sr>=10?'c-amber':'c-red'} mono">${sr.toFixed(1)}%</div>
        <div class="stat-sub">${inr(dash.income)} income this month</div>
      </div>`;

    // ── Charts ─────────────────────────────────────────────────────────────
    const snapsSorted = [...snaps].sort((a,b) => a.month.localeCompare(b.month));
    Charts.area('nw-chart',
      snapsSorted.map(s => monthLabel(s.month)),
      [{ label:'Net Worth', data: snapsSorted.map(s => +s.net_worth), color:'#7c3aed' }]);

    const clsData = dash.byClass.sort((a,b) => +b.value - +a.value).slice(0, 8);
    Charts.doughnut('alloc-chart',
      clsData.map(c => ASSET_LABELS[c.asset_class] || c.asset_class),
      clsData.map(c => +c.value),
      clsData.map(c => ASSET_COLORS[c.asset_class] || '#6b7280'));

    Charts.groupedBar('cashflow-chart',
      monthly.map(m => monthLabel(m.month)),
      [
        { label:'Income',  data: monthly.map(m => +m.income),  color:'#10b981' },
        { label:'Expense', data: monthly.map(m => +m.expense), color:'#f43f5e' },
      ]);

    Charts.horizontalBar('top-exp-chart',
      cats.map(c => c.category),
      cats.map(c => +c.total),
      cats.map(c => ASSET_COLORS[c.category] || '#6366f1'));

    // ── Budget Status card ─────────────────────────────────────────────────
    renderBudgetStatus(dash.budgetStatus || []);

  } catch (err) {
    Toast.show('Failed to load dashboard: ' + err.message, 'error');
  }
});

function renderBudgetStatus(budgets) {
  const el = document.getElementById('budget-status-content');
  if (!el) return;

  if (!budgets.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:16px 0">
        <p style="color:var(--text3);font-size:13px;margin-bottom:10px">No budgets set for this month.</p>
        <button class="btn btn-outline btn-sm" onclick="Router.go('budget')">Set Up Budgets →</button>
      </div>`;
    return;
  }

  const rows = budgets.map(b => {
    const pct    = parseFloat(b.percentage_used) || 0;
    const over   = pct >= 100;
    const warn   = pct >= 80 && pct < 100;
    const color  = over ? '#f43f5e' : warn ? '#f59e0b' : '#10b981';
    const badge  = over
      ? `<span class="badge badge-danger">Over</span>`
      : warn
      ? `<span class="badge badge-warning">${pct.toFixed(0)}%</span>`
      : `<span class="badge badge-success">${pct.toFixed(0)}%</span>`;

    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="width:110px;font-size:12px;color:#f1f5f9;text-transform:capitalize;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${b.category}
        </div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:3px">
            <span>${inr(b.actual_spending)} of ${inr(b.budget)}</span>
            <span style="color:${color};font-weight:600">${pct.toFixed(0)}% used</span>
          </div>
          <div class="progress-bg">
            <div class="progress-bar" style="width:${Math.min(100,pct)}%;background:${color}"></div>
          </div>
        </div>
        ${badge}
      </div>`;
  });

  const overCount = budgets.filter(b => parseFloat(b.percentage_used) >= 100).length;
  const warnCount = budgets.filter(b => { const p = parseFloat(b.percentage_used); return p >= 80 && p < 100; }).length;

  el.innerHTML = `
    <div style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap">
      ${overCount  ? `<span class="badge badge-danger">${overCount} over budget</span>` : ''}
      ${warnCount  ? `<span class="badge badge-warning">${warnCount} near limit</span>` : ''}
      ${!overCount && !warnCount ? `<span class="badge badge-success">All budgets on track 🎉</span>` : ''}
    </div>
    ${rows.join('')}`;
}
