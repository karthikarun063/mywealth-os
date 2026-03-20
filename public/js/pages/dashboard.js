'use strict';

// ── Dashboard page ────────────────────────────────────────────────────────────
Router.register('dashboard', async () => {
  const c = document.getElementById('page-container');
  c.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Dashboard</h1><p class="page-sub">Your wealth at a glance</p></div>
    </div>

    <div class="grid-4" id="dash-kpis" style="margin-bottom:14px">
      ${Array(4).fill(`<div class="stat-card"><div style="height:50px;background:var(--bg3);border-radius:8px;animation:pulse 1.5s infinite"></div></div>`).join('')}
    </div>

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

    <div class="grid-2" style="margin-bottom:12px">
      <div class="card">
        <div class="section-title">Income vs Expenses (6 months)</div>
        <div class="chart-wrap" style="height:180px"><canvas id="cashflow-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="section-title">Top Expenses This Month</div>
        <div class="chart-wrap" style="height:180px"><canvas id="top-exp-chart"></canvas></div>
      </div>
    </div>

    <div class="card" id="budget-status-card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="section-title" style="margin-bottom:0">📊 Budget Status</div>
        <button class="btn btn-ghost btn-sm" onclick="Router.go('budget')" style="font-size:11px">View All →</button>
      </div>
      <div id="budget-status-content" style="display:flex;align-items:center;justify-content:center;min-height:60px">
        <span style="color:var(--text3);font-size:13px">Loading budget status…</span>
      </div>
    </div>

    <div class="card" id="strategy-card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="section-title" style="margin-bottom:0">🧠 Your Financial Strategy</div>
        <a href="/strategy.html" style="font-size:11px;color:#a78bfa;text-decoration:none;font-weight:600">Full Report →</a>
      </div>
      <div id="strategy-content">
        <div style="text-align:center;padding:20px;color:var(--text3)">Generating strategy…</div>
      </div>
    </div>

    <div class="card" id="report-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="section-title" style="margin-bottom:0">📄 AI Financial Report</div>
        <a href="/report.html" style="font-size:11px;color:#a78bfa;text-decoration:none;font-weight:600">View Report →</a>
      </div>
      <div id="report-content">
        <div style="text-align:center;padding:12px;color:var(--text3);font-size:13px">Loading report preview…</div>
      </div>
    </div>
  `;

  // Load main dashboard data
  try {
    const [dash, snaps, monthly, cats] = await Promise.all([
      API.dashboard(),
      API.snapshots(),
      API.txMonthlySummary(),
      API.txCategoryTotals(currentMonth()),
    ]);

    // KPIs
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

    // Charts
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

    renderBudgetStatus(dash.budgetStatus || []);

  } catch (err) {
    Toast.show('Failed to load dashboard: ' + err.message, 'error');
  }

  // Load strategy card (non-blocking)
  loadStrategyCard();

  // Load AI report card (non-blocking)
  loadReportCard();
});

// ── Budget Status ─────────────────────────────────────────────────────────────
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

  const overCount = budgets.filter(b => parseFloat(b.percentage_used) >= 100).length;
  const warnCount = budgets.filter(b => { const p = parseFloat(b.percentage_used); return p >= 80 && p < 100; }).length;

  el.innerHTML = `
    <div style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap">
      ${overCount ? `<span class="badge badge-danger">${overCount} over budget</span>` : ''}
      ${warnCount ? `<span class="badge badge-warning">${warnCount} near limit</span>` : ''}
      ${!overCount && !warnCount ? `<span class="badge badge-success">All budgets on track 🎉</span>` : ''}
    </div>
    ${budgets.map(b => {
      const pct   = parseFloat(b.percentage_used) || 0;
      const over  = pct >= 100;
      const warn  = pct >= 80 && pct < 100;
      const color = over ? '#f43f5e' : warn ? '#f59e0b' : '#10b981';
      const badge = over
        ? `<span class="badge badge-danger">Over</span>`
        : warn
        ? `<span class="badge badge-warning">${pct.toFixed(0)}%</span>`
        : `<span class="badge badge-success">${pct.toFixed(0)}%</span>`;
      return `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="width:110px;font-size:12px;color:#f1f5f9;text-transform:capitalize;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
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
    }).join('')}`;
}

// ── Strategy Card ─────────────────────────────────────────────────────────────
async function loadStrategyCard() {
  const el = document.getElementById('strategy-content');
  if (!el) return;
  try {
    const d = await fetch('/api/strategy-report').then(r => r.json());
    const scoreColor = d.score >= 75 ? '#10b981' : d.score >= 50 ? '#f59e0b' : '#ef4444';
    const riskColor  = { Low:'#10b981', Moderate:'#f59e0b', High:'#f97316', Critical:'#ef4444' }[d.risk_level] || '#f59e0b';
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:start">
        <div style="text-align:center">
          <div style="font-size:48px;font-weight:900;color:${scoreColor};line-height:1">${d.score}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">/ 100</div>
          <div style="margin-top:8px;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;display:inline-block;
            background:${riskColor}20;color:${riskColor};border:1px solid ${riskColor}40">${d.risk_level} Risk</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:8px">Top 3 Actions</div>
          ${(d.recommended_actions || []).slice(0,3).map(a => `
            <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
              <div style="width:22px;height:22px;border-radius:50%;background:#7c3aed;color:#fff;font-weight:800;
                display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0">${a.priority}</div>
              <div>
                <div style="font-size:12px;font-weight:600;color:#f1f5f9">${a.action}</div>
                <div style="font-size:10px;color:var(--text3);margin-top:1px">${a.impact}</div>
              </div>
            </div>`).join('')}
          <a href="/strategy.html" style="display:inline-block;margin-top:4px;font-size:11px;background:#7c3aed;color:#fff;padding:6px 14px;border-radius:8px;text-decoration:none;font-weight:600">
            View Full Strategy →
          </a>
        </div>
      </div>`;
  } catch(e) {
    el.innerHTML = `<span style="color:var(--text3);font-size:13px">Strategy unavailable — <a href="/strategy.html" style="color:#a78bfa">open strategy page</a></span>`;
  }
}

// ── AI Report Card ────────────────────────────────────────────────────────────
async function loadReportCard() {
  const el = document.getElementById('report-content');
  if (!el) return;
  try {
    const d = await fetch('/api/report-data').then(r => r.json());
    const scoreColor = d.score >= 70 ? '#10b981' : d.score >= 40 ? '#f59e0b' : '#ef4444';
    const suggestion = d.aiGuidance?.suggestions?.[0] || 'Track expenses and grow your savings rate.';
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center">
        <div style="text-align:center;background:#0a0f1e;border:1px solid #1e293b;border-radius:12px;padding:14px 20px">
          <div style="font-size:40px;font-weight:900;color:${scoreColor};line-height:1">${d.score}</div>
          <div style="font-size:10px;color:var(--text3)">/ 100</div>
          <div style="margin-top:6px;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;
            background:${scoreColor}18;color:${scoreColor};border:1px solid ${scoreColor}40;display:inline-block">
            ${d.riskLevel} Risk
          </div>
        </div>
        <div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;line-height:1.5">${suggestion}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a href="/report.html" style="font-size:11px;background:#7c3aed;color:#fff;padding:6px 14px;border-radius:8px;text-decoration:none;font-weight:600">
              View Full Report →
            </a>
            <button onclick="dashDownloadPDF()" style="font-size:11px;background:transparent;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:600">
              ⬇ Download PDF
            </button>
          </div>
        </div>
      </div>`;
  } catch(e) {
    el.innerHTML = `<span style="color:var(--text3);font-size:13px">Report unavailable — <a href="/report.html" style="color:#a78bfa">open report page</a></span>`;
  }
}