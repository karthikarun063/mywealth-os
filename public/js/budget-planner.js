'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   MyWealth OS — Standalone Budget Planner
   File: /public/js/budget-planner.js
   ══════════════════════════════════════════════════════════════════════════ */

const BUDGET_CATEGORIES = [
  'rent','groceries','transport','shopping','utilities','insurance',
  'education','medical','entertainment','travel','investments',
  'food','dining','subscriptions','personal_care','other',
];

const STATUS_COLOR = {
  exceeded: '#f43f5e',
  warning:  '#f59e0b',
  on_track: '#6366f1',
  healthy:  '#10b981',
};

const STATUS_BADGE = {
  exceeded: '<span class="badge badge-danger">Over Budget</span>',
  warning:  '<span class="badge badge-warning">Near Limit</span>',
  on_track: '<span class="badge badge-info">On Track</span>',
  healthy:  '<span class="badge badge-success">Healthy</span>',
};

// ── State ─────────────────────────────────────────────────────────────────
const BP = {
  _data:        [],   // from /api/budgets
  _unbudgeted:  [],   // unbudgeted categories
  _summary:     {},   // aggregate summary
  _month:       new Date().getMonth() + 1,
  _year:        new Date().getFullYear(),
  _filter:      'all',
  _search:      '',
  _sortCol:     'budget',
  _sortDir:     'desc',

  // ── Init ──────────────────────────────────────────────────────────────

  init() {
    this._buildMonthSelector();
    this.load();

    // Filter chips
    qsa('#bp-filters .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._filter = chip.dataset.filter;
        qsa('#bp-filters .chip').forEach(c => c.classList.toggle('active', c === chip));
        this._renderTable();
      });
    });
  },

  _buildMonthSelector() {
    const sel = qs('#bp-month');
    if (!sel) return;
    sel.innerHTML = '';
    for (let i = -1; i <= 5; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i + 1);
      const m   = d.getMonth() + 1;
      const y   = d.getFullYear();
      const opt = document.createElement('option');
      opt.value   = `${m}|${y}`;
      opt.textContent = d.toLocaleDateString('en-IN', { month:'long', year:'numeric' });
      if (m === this._month && y === this._year) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      const [m, y] = sel.value.split('|').map(Number);
      this._month = m; this._year = y;
      this.load();
    });
  },

  // ── Load data ────────────────────────────────────────────────────────

  async load() {
    const monthStr = `${this._year}-${String(this._month).padStart(2,'0')}`;
    try {
      const res        = await API.budgets(monthStr);
      this._data        = res.data       || [];
      this._unbudgeted  = res.unbudgeted || [];
      this._summary     = res.summary    || {};
      this._renderAll();
    } catch (err) {
      Toast.show('Failed to load: ' + err.message, 'error');
    }
  },

  // ── Render all sections ──────────────────────────────────────────────

  _renderAll() {
    this._renderKPIs();
    this._renderCharts();
    this._renderTable();
    this._renderUnbudgeted();
    this._renderInsights();
  },

  // ── KPI strip ────────────────────────────────────────────────────────

  _renderKPIs() {
    const s        = this._summary;
    const utilPct  = parseFloat(s.utilizationPct) || 0;
    const utColor  = utilPct >= 100 ? '#f43f5e' : utilPct >= 80 ? '#f59e0b' : '#10b981';
    const monthLbl = new Date(this._year, this._month - 1)
      .toLocaleDateString('en-IN', { month:'long', year:'numeric' });

    const kpis = [
      {
        label: 'Total Budget',
        value: inr(s.totalBudget),
        cls:   'c-violet',
        sub:   `${s.budgetCount} categories · ${monthLbl}`,
      },
      {
        label: 'Total Spent',
        value: inr(s.totalSpent),
        cls:   utilPct >= 100 ? 'c-red' : 'c-amber',
        sub:   `${utilPct.toFixed(1)}% of budget`,
        bar:   { pct: Math.min(100, utilPct), color: utColor },
      },
      {
        label: 'Remaining',
        value: inr(Math.abs(+s.totalRemaining)),
        cls:   +s.totalRemaining < 0 ? 'c-red' : 'c-green',
        sub:   +s.totalRemaining < 0 ? 'Over budget!' : 'Left to spend',
        prefix: +s.totalRemaining < 0 ? '−' : '+',
      },
      {
        label: 'Over Budget',
        value: `${s.overspentCount}`,
        cls:   s.overspentCount > 0 ? 'c-red' : 'c-green',
        sub:   `categor${s.overspentCount === 1 ? 'y' : 'ies'} exceeded`,
      },
      {
        label: 'Unbudgeted',
        value: `${this._unbudgeted.length}`,
        cls:   this._unbudgeted.length > 0 ? 'c-amber' : 'c-muted',
        sub:   'categories with no budget',
      },
    ];

    document.getElementById('bp-kpis').innerHTML = kpis.map(k => `
      <div class="bp-kpi">
        <div class="bp-kpi-label">${k.label}</div>
        <div class="bp-kpi-value ${k.cls}">${k.prefix || ''}${k.value}</div>
        <div class="bp-kpi-sub">${k.sub}</div>
        ${k.bar ? `<div class="bp-kpi-bar"><div class="progress-bg" style="height:4px;margin-top:6px"><div class="progress-bar" style="width:${k.bar.pct}%;background:${k.bar.color}"></div></div></div>` : ''}
      </div>`).join('');
  },

  // ── Charts ────────────────────────────────────────────────────────────

  _renderCharts() {
    const budgets = this._data;
    if (!budgets.length) return;

    const cats   = budgets.map(b => b.category);
    const budgAm = budgets.map(b => parseFloat(b.budget));
    const actuAm = budgets.map(b => parseFloat(b.actual_spending));
    const colors = budgets.map(b => STATUS_COLOR[this._getStatus(b)] || '#6b7280');

    // Grouped bar
    destroyChart('bp-bar');
    mkChart('bp-bar', {
      type: 'bar',
      data: {
        labels: cats,
        datasets: [
          {
            label: 'Budget',
            data: budgAm,
            backgroundColor: '#334155',
            borderRadius: 4,
            borderSkipped: false,
          },
          {
            label: 'Actual',
            data: actuAm,
            backgroundColor: actuAm.map((v,i) => v > budgAm[i] ? '#f43f5e' : '#10b981'),
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { boxWidth: 10, padding: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${inr(ctx.raw)}`,
              afterBody: (items) => {
                const i   = items[0].dataIndex;
                const pct = budgAm[i] > 0 ? (actuAm[i] / budgAm[i] * 100).toFixed(1) : 0;
                return [`Utilised: ${pct}%`];
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 35 } },
          y: { grid: { color: '#1e293b' }, ticks: { callback: v => inr(v) } },
        },
      },
    });

    // Doughnut — utilisation %
    destroyChart('bp-donut');
    mkChart('bp-donut', {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{
          data:            budgAm,
          backgroundColor: colors,
          borderColor:     'transparent',
          hoverOffset:     6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: {
            display: true, position: 'bottom',
            labels: { boxWidth: 10, padding: 10, font: { size: 10 } },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const b = budgets[ctx.dataIndex];
                const p = b.percentage_used;
                return [`${b.category}: ${inr(b.actual_spending)} / ${inr(b.budget)}`, `${p}% utilised`];
              },
            },
          },
        },
      },
    });

    // Line trend — we only have current period data, so show a sparkline of utilisation
    destroyChart('bp-trend');
    const sorted = [...budgets].sort((a,b) => parseFloat(b.percentage_used) - parseFloat(a.percentage_used)).slice(0, 8);
    mkChart('bp-trend', {
      type: 'bar',
      data: {
        labels: sorted.map(b => b.category),
        datasets: [{
          label: '% Used',
          data:  sorted.map(b => parseFloat(b.percentage_used) || 0),
          backgroundColor: sorted.map(b => STATUS_COLOR[this._getStatus(b)] || '#6b7280'),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.raw}% of budget used` } },
        },
        scales: {
          x: {
            grid: { color: '#1e293b' },
            ticks: { callback: v => `${v}%` },
            max: 120,
          },
          y: { grid: { display: false } },
        },
      },
    });
  },

  // ── Table ─────────────────────────────────────────────────────────────

  sort(col) {
    if (this._sortCol === col) {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortCol = col;
      this._sortDir = 'desc';
    }
    // Update header classes
    qsa('#bp-table th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.col === col) th.classList.add(`sorted-${this._sortDir}`);
    });
    this._renderTable();
  },

  search(val) {
    this._search = val.toLowerCase();
    this._renderTable();
  },

  _getStatus(b) {
    const pct = parseFloat(b.percentage_used) || 0;
    if (pct >= 100) return 'exceeded';
    if (pct >= 80)  return 'warning';
    if (pct >= 50)  return 'on_track';
    return 'healthy';
  },

  _renderTable() {
    let rows = [...this._data];

    // Filter by status
    if (this._filter !== 'all') {
      rows = rows.filter(b => this._getStatus(b) === this._filter);
    }

    // Search
    if (this._search) {
      rows = rows.filter(b => b.category.toLowerCase().includes(this._search));
    }

    // Sort
    rows.sort((a, b) => {
      let av, bv;
      if (this._sortCol === 'category') { av = a.category; bv = b.category; }
      else if (this._sortCol === 'budget')  { av = +a.budget;          bv = +b.budget; }
      else if (this._sortCol === 'actual')  { av = +a.actual_spending;  bv = +b.actual_spending; }
      else if (this._sortCol === 'diff')    { av = +a.difference;       bv = +b.difference; }
      else if (this._sortCol === 'pct')     { av = +a.percentage_used;  bv = +b.percentage_used; }
      else av = bv = 0;

      if (typeof av === 'string') {
        return this._sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return this._sortDir === 'asc' ? av - bv : bv - av;
    });

    // Status message
    document.getElementById('bp-status-msg').textContent =
      `${rows.length} of ${this._data.length} budget${this._data.length !== 1 ? 's' : ''}`;

    // Rows
    if (!rows.length) {
      document.getElementById('bp-tbody').innerHTML = `
        <tr><td colspan="7" class="table-empty">
          ${this._search ? `No categories matching "${this._search}"` : 'No budgets match this filter.'}
        </td></tr>`;
      document.getElementById('bp-tfoot').innerHTML = '';
      return;
    }

    document.getElementById('bp-tbody').innerHTML = rows.map(b => {
      const budget = parseFloat(b.budget);
      const actual = parseFloat(b.actual_spending);
      const diff   = parseFloat(b.difference);
      const pct    = Math.min(150, parseFloat(b.percentage_used) || 0);
      const over   = actual > budget;
      const status = this._getStatus(b);
      const color  = STATUS_COLOR[status];

      return `
        <tr class="row-${status}" data-id="${b.id}">
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
              <strong style="color:#f1f5f9;text-transform:capitalize">${b.category}</strong>
            </div>
          </td>
          <td class="mono" style="color:var(--text2)">${inr(budget)}</td>
          <td class="mono" style="font-weight:700;color:${over?'#f87171':'#34d399'}">${inr(actual)}</td>
          <td>
            <span class="mono" style="font-weight:700;color:${over?'#f87171':'#34d399'}">
              ${over ? '−' : '+'}${inr(Math.abs(diff))}
            </span>
          </td>
          <td>
            <div class="bp-progress-wrap">
              <div class="progress-bg" style="flex:1">
                <div class="progress-bar" style="width:${Math.min(100,pct)}%;background:${color};transition:width .6s"></div>
              </div>
              ${pct > 100 ? `<span style="font-size:10px;color:#f87171;flex-shrink:0;font-weight:700">${pct.toFixed(0)}%</span>` : ''}
            </div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;font-variant-numeric:tabular-nums;color:${color};font-weight:700">${pct.toFixed(1)}%</span>
              ${STATUS_BADGE[status]}
            </div>
          </td>
          <td>
            <div style="display:flex;gap:4px">
              <button
                class="btn btn-outline btn-sm btn-icon"
                onclick="BP.openEdit('${b.id}','${b.category}',${budget})"
                title="Edit budget">✎</button>
              <button
                class="btn btn-danger btn-sm btn-icon"
                onclick="BP.del('${b.id}','${b.category}')"
                title="Delete budget">✕</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    // Totals footer
    const totalBudget = rows.reduce((s, b) => s + parseFloat(b.budget),          0);
    const totalActual = rows.reduce((s, b) => s + parseFloat(b.actual_spending),  0);
    const totalDiff   = rows.reduce((s, b) => s + parseFloat(b.difference),       0);
    const totalOver   = totalActual > totalBudget;
    document.getElementById('bp-tfoot').innerHTML = `
      <tr style="background:var(--bg2);font-weight:700;border-top:2px solid var(--border2)">
        <td style="color:#f1f5f9">Total (${rows.length})</td>
        <td class="mono" style="color:var(--text2)">${inr(totalBudget)}</td>
        <td class="mono" style="color:${totalOver?'#f87171':'#34d399'}">${inr(totalActual)}</td>
        <td class="mono" style="color:${totalOver?'#f87171':'#34d399'}">${totalOver?'−':'+'}${inr(Math.abs(totalDiff))}</td>
        <td colspan="3"></td>
      </tr>`;
  },

  // ── Unbudgeted spending ───────────────────────────────────────────────

  _renderUnbudgeted() {
    const el = document.getElementById('bp-unbudgeted');
    if (!this._unbudgeted.length) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div style="padding:14px 16px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
          ⚠ Unbudgeted Categories (${this._unbudgeted.length})
        </div>
        <div class="bp-unbudgeted-grid">
          ${this._unbudgeted.map(u => `
            <div class="bp-unbudgeted-item">
              <div>
                <div style="font-size:11px;font-weight:600;color:#f1f5f9;text-transform:capitalize">${u.category}</div>
                <div style="font-size:10px;color:var(--text3)">No budget set</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:13px;font-weight:700;color:#fbbf24;font-variant-numeric:tabular-nums">${inr(u.actual_spending)}</div>
                <button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 8px;margin-top:4px"
                  onclick="BP.openAddFor('${u.category}')">+ Budget</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  // ── Insights panel ────────────────────────────────────────────────────

  _renderInsights() {
    const insights = [];
    const d = this._data;

    // Find worst overspend
    const worst = [...d].sort((a,b) => parseFloat(b.actual_spending)-parseFloat(a.actual_spending))
                        .filter(b => parseFloat(b.actual_spending) > parseFloat(b.budget));
    if (worst.length) {
      const w = worst[0];
      insights.push({
        icon: '🚨',
        text: `<strong>${w.category}</strong> is your biggest overspend — you've used <strong>${w.percentage_used}%</strong> of the ₹${inr(w.budget)} budget, spending <strong>${inr(w.actual_spending)}</strong>.`,
      });
    }

    // Best category
    const best = [...d].filter(b=>parseFloat(b.actual_spending)>0)
                       .sort((a,b)=>parseFloat(a.percentage_used)-parseFloat(b.percentage_used))[0];
    if (best) {
      insights.push({
        icon: '✅',
        text: `<strong>${best.category}</strong> is well under control at only <strong>${best.percentage_used}%</strong> utilised (${inr(best.actual_spending)} of ${inr(best.budget)}).`,
      });
    }

    // Categories with no spending at all
    const unused = d.filter(b => parseFloat(b.actual_spending) === 0);
    if (unused.length) {
      insights.push({
        icon: '💤',
        text: `${unused.length} budget${unused.length>1?'s are':' is'} unused this month: <strong>${unused.map(b=>b.category).join(', ')}</strong>. Consider rolling over or reallocating.`,
      });
    }

    // Unbudgeted spending total
    const unbudgTotal = this._unbudgeted.reduce((s,u)=>s+parseFloat(u.actual_spending),0);
    if (unbudgTotal > 0) {
      insights.push({
        icon: '⚠️',
        text: `You spent <strong>${inr(unbudgTotal)}</strong> across <strong>${this._unbudgeted.length} unbudgeted</strong> categor${this._unbudgeted.length>1?'ies':'y'} this month. Set budgets for better tracking.`,
      });
    }

    // Savings tip
    const s = this._summary;
    const leftover = parseFloat(s.totalRemaining) || 0;
    if (leftover > 0) {
      insights.push({
        icon: '💡',
        text: `You have <strong>${inr(leftover)}</strong> remaining across all budgets. Consider moving the surplus to savings, SIPs, or paying down high-interest debt.`,
      });
    }

    document.getElementById('bp-insights-content').innerHTML = insights.length
      ? insights.map(i => `
          <div class="bp-insight-item">
            <span class="bp-insight-icon">${i.icon}</span>
            <span class="bp-insight-text">${i.text}</span>
          </div>`).join('')
      : `<p style="color:var(--text3);font-size:13px">Add budgets and transactions to see personalised insights.</p>`;
  },

  // ── CRUD ──────────────────────────────────────────────────────────────

  openAdd()        { this._openForm(); },
  openEdit(id,cat,amt) { this._openForm({ id, category:cat, monthly_budget:amt }); },
  openAddFor(cat)  { this._openForm({ preset: cat }); },

  _openForm(existing = null) {
    const isEdit   = existing && existing.id;
    const monthLbl = new Date(this._year, this._month-1)
      .toLocaleDateString('en-IN', { month:'long', year:'numeric' });

    Modal.open(isEdit ? `Edit: ${existing.category}` : 'Set Monthly Budget', `
      <div style="background:var(--bg2);border-radius:10px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:var(--text3)">
        📅 Setting budget for <strong style="color:#f1f5f9">${monthLbl}</strong>
      </div>

      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="bpf-cat" ${isEdit ? 'disabled' : ''}>
          ${BUDGET_CATEGORIES.map(c => `
            <option value="${c}"
              ${(existing?.category || existing?.preset) === c ? 'selected':''}>
              ${c.charAt(0).toUpperCase()+c.slice(1).replace(/_/g,' ')}
            </option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Monthly Budget (₹)</label>
        <input type="number" class="form-input" id="bpf-amt"
          value="${existing?.monthly_budget || ''}"
          placeholder="e.g. 15000" min="1" step="100"/>
        <div id="bpf-err" class="form-error" style="display:none"></div>
      </div>

      <div id="bpf-preview"></div>

      <div class="form-actions">
        <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="BP.save('${existing?.id || ''}')">
          ${isEdit ? '✓ Update' : '+ Save Budget'}
        </button>
      </div>`);

    qs('#bpf-amt')?.addEventListener('input', () => {
      const a = +qs('#bpf-amt').value;
      qs('#bpf-preview').innerHTML = a > 0 ? `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
            ${[['Daily',inr(a/30)],['Weekly',inr(a/4.3)],['Monthly',inr(a)]].map(([l,v])=>
              `<div><div style="font-size:9px;color:var(--text3)">${l}</div><div style="font-size:13px;font-weight:700;color:#f1f5f9">${v}</div></div>`
            ).join('')}
          </div>
        </div>` : '';
    });
    // trigger once for edit
    if (existing?.monthly_budget) qs('#bpf-amt')?.dispatchEvent(new Event('input'));
  },

  async save(id) {
    const amt = +qs('#bpf-amt')?.value;
    const cat = qs('#bpf-cat')?.value;
    const err = qs('#bpf-err');

    if (!amt || amt < 1) {
      err.textContent = 'Please enter a valid amount.';
      err.style.display = 'block';
      qs('#bpf-amt')?.focus();
      return;
    }
    err.style.display = 'none';

    try {
      if (id) {
        await API.updateBudget(id, { monthly_budget: amt });
        Toast.show(`Updated "${cat}" budget to ${inr(amt)}`);
      } else {
        await API.createBudget({
          category:       cat,
          monthly_budget: amt,
          month:          this._month,
          year:           this._year,
        });
        Toast.show(`Budget for "${cat}" set — ${inr(amt)}/month`);
      }
      Modal.close();
      await this.load();
    } catch (err) {
      Toast.show(err.message || 'Save failed', 'error');
    }
  },

  del(id, category) {
    Confirm(`Remove the budget for "${category}"? Actual spending data will be kept.`, async () => {
      try {
        await API.deleteBudget(id);
        Toast.show(`Budget for "${category}" removed`, 'warning');
        await this.load();
      } catch (err) {
        Toast.show(err.message, 'error');
      }
    });
  },
};

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => BP.init());
