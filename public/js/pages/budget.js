'use strict';
/* ── Budget Planner — SPA Page ───────────────────────────────── */
Router.register('budget', () => BudgetPage.render());

const BUDGET_CATS = [
  'rent','groceries','transport','shopping','utilities','insurance',
  'education','medical','entertainment','travel','investments',
  'food','dining','subscriptions','personal_care','other',
];

const BudgetPage = {
  _data:       [],
  _unbudgeted: [],
  _month:      new Date().getMonth() + 1,
  _year:       new Date().getFullYear(),

  render() {
    document.getElementById('page-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Budget Planner</h1>
          <p class="page-sub" id="bp-sub">Loading…</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select class="form-select" id="bp-month-sel" style="width:auto;padding:6px 10px;font-size:12px" onchange="BudgetPage.changeMonth()">
            ${this._buildMonthOptions()}
          </select>
          <button class="btn btn-primary" onclick="BudgetPage.openAdd()">+ Set Budget</button>
        </div>
      </div>

      <!-- KPI row -->
      <div class="grid-4" id="bp-kpis" style="margin-bottom:14px">
        ${Array(4).fill(`<div class="stat-card"><div style="height:50px;background:var(--bg3);border-radius:8px;animation:pulse 1.5s infinite"></div></div>`).join('')}
      </div>

      <!-- Charts row -->
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:14px">
        <div class="card">
          <div class="section-title">Budget vs Actual Spending</div>
          <div class="chart-wrap" style="height:230px"><canvas id="bp-bar-chart"></canvas></div>
        </div>
        <div class="card">
          <div class="section-title">Utilisation by Category</div>
          <div class="chart-wrap" style="height:230px"><canvas id="bp-donut-chart"></canvas></div>
        </div>
      </div>

      <!-- Comparison table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">
          <div class="section-title" style="margin-bottom:0">Category Breakdown</div>
          <div style="display:flex;gap:6px" id="bp-status-filters">
            ${['all','exceeded','warning','on_track','healthy'].map(s =>
              `<button class="chip ${s==='all'?'active':''}" onclick="BudgetPage.setStatusFilter('${s}')">${
                s==='all'?'All':s.replace('_',' ')
              }</button>`
            ).join('')}
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Monthly Budget</th>
                <th>Actual Spending</th>
                <th>Difference</th>
                <th>Progress</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="bp-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- Unbudgeted spending -->
      <div id="bp-unbudgeted"></div>
    `;

    this._statusFilter = 'all';
    this.load();
  },

  _buildMonthOptions() {
    const options = [];
    const d = new Date();
    // Last 6 months + next month
    for (let i = -1; i <= 6; i++) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i + 1, 1);
      const m  = dt.getMonth() + 1;
      const y  = dt.getFullYear();
      const label = dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const sel   = (m === this._month && y === this._year) ? 'selected' : '';
      options.push(`<option value="${m}|${y}" ${sel}>${label}</option>`);
    }
    return options.join('');
  },

  changeMonth() {
    const val = qs('#bp-month-sel')?.value || `${new Date().getMonth()+1}|${new Date().getFullYear()}`;
    const [m, y] = val.split('|').map(Number);
    this._month = m; this._year = y;
    this.load();
  },

  async load() {
    try {
      const res = await API.budgets(
        `${this._year}-${String(this._month).padStart(2,'0')}`
      );
      this._data       = res.data       || [];
      this._unbudgeted = res.unbudgeted || [];
      const s          = res.summary    || {};

      document.getElementById('bp-sub').textContent =
        `${new Date(this._year, this._month - 1).toLocaleDateString('en-IN',{month:'long',year:'numeric'})} · ${this._data.length} budgets set`;

      // KPIs
      const util = +s.utilizationPct || 0;
      document.getElementById('bp-kpis').innerHTML = [
        ['Total Budget',     inr(s.totalBudget),    'c-violet'],
        ['Total Spent',      inr(s.totalSpent),     's'],
        ['Remaining',        inr(Math.max(0, s.totalRemaining)), s.totalRemaining < 0 ? 'c-red' : 'c-green'],
        ['Overspent',        `${s.overspentCount} categor${s.overspentCount===1?'y':'ies'}`, s.overspentCount > 0 ? 'c-red' : 'c-green'],
      ].map(([l, v, c]) => `
        <div class="stat-card">
          <div class="stat-label">${l}</div>
          <div class="stat-val ${c} mono">${v}</div>
          ${l === 'Total Spent' ? `<div class="stat-sub">${util.toFixed(1)}% of budget</div>` : ''}
        </div>`).join('');

      this._renderCharts();
      this._renderTable();
      this._renderUnbudgeted();
    } catch (err) { Toast.show('Failed to load budgets: ' + err.message, 'error'); }
  },

  _renderCharts() {
    const cats = this._data.map(b => b.category);
    const budg = this._data.map(b => parseFloat(b.budget));
    const actu = this._data.map(b => parseFloat(b.actual_spending));

    // Grouped bar: budget vs actual
    destroyChart('bp-bar-chart');
    mkChart('bp-bar-chart', {
      type: 'bar',
      data: {
        labels: cats,
        datasets: [
          { label: 'Budget', data: budg, backgroundColor: '#334155', borderRadius: 4, borderSkipped: false },
          { label: 'Actual', data: actu, borderRadius: 4, borderSkipped: false,
            backgroundColor: actu.map((v, i) => v > budg[i] ? '#f43f5e' : '#10b981') },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { boxWidth: 10, padding: 12 }},
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${inr(ctx.raw)}` }},
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#1e293b' }, ticks: { callback: v => inr(v) } },
        },
      },
    });

    // Doughnut: utilisation %
    destroyChart('bp-donut-chart');
    mkChart('bp-donut-chart', {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{
          data:            budg,
          backgroundColor: this._data.map(b => this._statusColor(b)),
          borderColor:     'transparent',
          hoverOffset:     6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { display: true, position: 'right', labels: { boxWidth: 10, padding: 10, font: { size: 10 } }},
          tooltip: {
            callbacks: {
              label: ctx => {
                const b = this._data[ctx.dataIndex];
                return `${b.category}: ${inr(b.actual_spending)} / ${inr(b.budget)} (${b.percentage_used}%)`;
              },
            },
          },
        },
      },
    });
  },

  _statusColor(b) {
    const pct = parseFloat(b.percentage_used) || 0;
    if (pct >= 100) return '#f43f5e';
    if (pct >= 80)  return '#f59e0b';
    if (pct >= 50)  return '#6366f1';
    return '#10b981';
  },

  setStatusFilter(f) {
    this._statusFilter = f;
    qsa('#bp-status-filters .chip').forEach(c => {
      c.classList.toggle('active', c.textContent.trim() === (f === 'all' ? 'All' : f.replace('_', ' ')));
    });
    this._renderTable();
  },

  _renderTable() {
    let rows = this._data;
    if (this._statusFilter !== 'all') {
      rows = rows.filter(b => {
        const pct = parseFloat(b.percentage_used) || 0;
        if (this._statusFilter === 'exceeded') return pct >= 100;
        if (this._statusFilter === 'warning')  return pct >= 80 && pct < 100;
        if (this._statusFilter === 'on_track') return pct >= 50 && pct < 80;
        if (this._statusFilter === 'healthy')  return pct < 50;
        return true;
      });
    }

    document.getElementById('bp-tbody').innerHTML = rows.length
      ? rows.map(b => {
          const budget = parseFloat(b.budget);
          const actual = parseFloat(b.actual_spending);
          const diff   = parseFloat(b.difference);
          const pct    = Math.min(150, parseFloat(b.percentage_used) || 0);
          const over   = actual > budget;
          const color  = this._statusColor(b);
          const status = pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : pct >= 50 ? 'on_track' : 'healthy';
          const badgeCls = { exceeded:'badge-danger', warning:'badge-warning', on_track:'badge-info', healthy:'badge-success' }[status];

          return `
          <tr style="${over ? 'background:rgba(244,63,94,.04)' : ''}">
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
                <span style="font-weight:600;color:#f1f5f9;text-transform:capitalize">${b.category}</span>
              </div>
            </td>
            <td class="mono" style="color:#94a3b8">${inr(budget)}</td>
            <td class="mono" style="font-weight:700;color:${over?'#f87171':'#34d399'}">${inr(actual)}</td>
            <td>
              <span class="mono" style="font-weight:700;color:${over?'#f87171':'#34d399'}">
                ${over ? '−'+inr(Math.abs(diff)) : '+'+inr(Math.abs(diff))}
              </span>
            </td>
            <td style="min-width:140px">
              <div style="display:flex;align-items:center;gap:8px">
                <div class="progress-bg" style="flex:1">
                  <div class="progress-bar" style="width:${Math.min(100,pct)}%;background:${color}"></div>
                </div>
                <span style="font-size:10px;color:var(--text3);width:34px;text-align:right;flex-shrink:0">${pct.toFixed(0)}%</span>
              </div>
            </td>
            <td><span class="badge ${badgeCls}">${status.replace('_',' ')}</span></td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn btn-outline btn-sm btn-icon" onclick="BudgetPage.openEdit('${b.id}','${b.category}',${budget})" title="Edit">✎</button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="BudgetPage.del('${b.id}','${b.category}')" title="Delete">✕</button>
              </div>
            </td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="7" class="table-empty">No budgets match this filter.</td></tr>`;
  },

  _renderUnbudgeted() {
    if (!this._unbudgeted.length) {
      document.getElementById('bp-unbudgeted').innerHTML = '';
      return;
    }
    document.getElementById('bp-unbudgeted').innerHTML = `
      <div class="card" style="margin-top:14px;border-color:rgba(245,158,11,.25)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="section-title" style="margin-bottom:0;color:#fbbf24">⚠ Unbudgeted Spending</div>
          <span style="font-size:11px;color:var(--text3)">These categories have spend but no budget set</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
          ${this._unbudgeted.map(u => `
            <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:11px;font-weight:600;color:#f1f5f9;text-transform:capitalize">${u.category}</div>
                <div style="font-size:10px;color:var(--text3)">No budget set</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:13px;font-weight:700;color:#fbbf24;font-variant-numeric:tabular-nums">${inr(u.actual_spending)}</div>
                <button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 8px;margin-top:4px" onclick="BudgetPage.openAddFor('${u.category}')">+ Set</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  // ── Modal helpers ────────────────────────────────────────────────────────

  openAdd() { this._openForm(); },
  openEdit(id, category, budget) { this._openForm({ id, category, monthly_budget: budget }); },
  openAddFor(category) { this._openForm({ preset_cat: category }); },

  _openForm(existing = null) {
    const isEdit   = existing && existing.id;
    const monthStr = new Date(this._year, this._month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    Modal.open(isEdit ? `Edit Budget: ${existing.category}` : 'Set Monthly Budget', `
      <div style="background:var(--bg2);border-radius:10px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:var(--text3)">
        📅 Setting budget for <strong style="color:#f1f5f9">${monthStr}</strong>
      </div>

      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="bp-f-cat" ${isEdit ? 'disabled' : ''}>
          ${BUDGET_CATS.map(c => `
            <option value="${c}" ${(existing?.category || existing?.preset_cat) === c ? 'selected' : ''}>
              ${c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g,' ')}
            </option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Monthly Budget (₹)</label>
        <input type="number" class="form-input" id="bp-f-amt"
          value="${existing?.monthly_budget || ''}"
          placeholder="e.g. 15000" min="1" step="100" autofocus/>
        <div id="bp-f-err" class="form-error" style="display:none"></div>
      </div>

      <div id="bp-f-preview" style="display:none;margin-bottom:12px"></div>

      <div class="form-actions">
        <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="BudgetPage.save('${existing?.id || ''}')">
          ${isEdit ? 'Update Budget' : 'Save Budget'}
        </button>
      </div>
    `);

    // Live preview
    qs('#bp-f-amt')?.addEventListener('input', () => BudgetPage._updatePreview());
  },

  _updatePreview() {
    const amt = +qs('#bp-f-amt')?.value || 0;
    const cat = qs('#bp-f-cat')?.value;
    const prev = qs('#bp-f-preview');
    if (!prev || !amt) { prev.style.display = 'none'; return; }

    const daily  = (amt / 30).toFixed(0);
    const weekly = (amt / 4).toFixed(0);

    prev.style.display = 'block';
    prev.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Budget breakdown</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${[['Monthly', inr(amt)], ['Weekly', inr(weekly)], ['Daily', inr(daily)]].map(([l,v]) =>
            `<div style="text-align:center"><div style="font-size:9px;color:var(--text3)">${l}</div><div style="font-size:13px;font-weight:700;color:#f1f5f9">${v}</div></div>`
          ).join('')}
        </div>
      </div>`;
  },

  async save(id) {
    const amt = +qs('#bp-f-amt')?.value;
    const cat = qs('#bp-f-cat')?.value;
    const err = qs('#bp-f-err');

    if (!amt || amt < 1) {
      err.textContent = 'Please enter a valid amount greater than ₹0';
      err.style.display = 'block';
      return;
    }
    err.style.display = 'none';

    const payload = {
      category:       cat,
      monthly_budget: amt,
      month:          this._month,
      year:           this._year,
    };

    try {
      if (id) {
        await API.updateBudget(id, { monthly_budget: amt });
        Toast.show(`Budget for "${cat}" updated to ${inr(amt)}`);
      } else {
        await API.createBudget(payload);
        Toast.show(`Budget for "${cat}" set to ${inr(amt)}`);
      }
      Modal.close();
      await this.load();
    } catch (err) { Toast.show(err.message, 'error'); }
  },

  del(id, category) {
    Confirm(`Remove budget for "${category}"?`, async () => {
      try {
        await API.deleteBudget(id);
        Toast.show(`Budget for "${category}" removed`, 'warning');
        await this.load();
      } catch (err) { Toast.show(err.message, 'error'); }
    });
  },
};
