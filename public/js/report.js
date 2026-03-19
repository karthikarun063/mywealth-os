'use strict';
/* ═══════════════════════════════════════════════════════════════
   MyWealth OS — AI Financial Report Page
   ═══════════════════════════════════════════════════════════ */

function inr(n, compact = true) {
  const abs = Math.abs(+n || 0);
  let s;
  if (compact) {
    if (abs >= 1e7) s = `${(abs/1e7).toFixed(2)} Cr`;
    else if (abs >= 1e5) s = `${(abs/1e5).toFixed(1)} L`;
    else if (abs >= 1e3) s = `${(abs/1e3).toFixed(1)} K`;
    else s = `${Math.round(abs)}`;
    return (n < 0 ? '−' : '') + '₹' + s;
  }
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);
}

function pct(v, d=1) { return `${(+v||0).toFixed(d)}%`; }

function scoreColor(score) {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function showToast(msg, dur = 3000) {
  const t = document.getElementById('rp-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

// ── Chart registry ────────────────────────────────────────────────────────────
const CHARTS = {};
function mkChart(id, cfg) {
  if (CHARTS[id]) { CHARTS[id].destroy(); }
  const canvas = document.getElementById(id);
  if (!canvas) return;
  CHARTS[id] = new Chart(canvas, cfg);
}

Chart.defaults.color          = '#94a3b8';
Chart.defaults.borderColor    = '#e2e8f0';
Chart.defaults.font.family    = "system-ui,-apple-system,'Segoe UI',sans-serif";
Chart.defaults.font.size      = 11;

// ── Main Report object ────────────────────────────────────────────────────────
const Report = {
  _data: null,

  async load() {
    document.getElementById('rp-loading').style.display = 'flex';
    document.getElementById('rp-content').classList.add('d-none');
    document.getElementById('btn-pdf').disabled   = true;
    document.getElementById('btn-share').disabled = true;

    try {
      const res  = await fetch('/api/report-data');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      this._data = data;
      this._render(data);
    } catch (err) {
      document.getElementById('rp-loading').innerHTML =
        `<div class="alert alert-danger mx-auto" style="max-width:480px">
          <strong>Failed to load report:</strong> ${err.message}<br/>
          <small>Ensure the database is connected and try again.</small>
         </div>`;
    }
  },

  async downloadPDF() {
    const btn = document.getElementById('btn-pdf');
    btn.disabled   = true;
    btn.textContent = '⏳ Generating PDF…';
    try {
      const res = await fetch('/api/report-pdf');
      if (!res.ok) throw new Error(`PDF failed: ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href:     url,
        download: `mywealth-report-${new Date().toISOString().slice(0,10)}.pdf`,
      });
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF downloaded! ✓');
    } catch (err) {
      showToast('PDF generation failed: ' + err.message);
    } finally {
      btn.disabled   = false;
      btn.textContent = '⬇ Download PDF';
    }
  },

  shareScore() {
    const d = this._data;
    if (!d) return;
    const text = `My Financial Score is ${d.score}/100 on MyWealth OS!\nRisk Level: ${d.riskLevel}\nTrack yours at: https://mywealth-os.vercel.app`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast('Score copied to clipboard! Share it anywhere ✓'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Score copied! ✓');
    }
  },

  _render(d) {
    document.getElementById('rp-loading').style.display = 'none';
    const el = document.getElementById('rp-content');
    el.classList.remove('d-none');

    const m     = d.metrics  || {};
    const ai    = d.aiGuidance || {};
    const color = scoreColor(d.score);
    const circ  = 2 * Math.PI * 54;
    const fill  = (d.score / 100) * circ;

    // Gen date
    document.getElementById('rp-gen-date').textContent =
      `Report generated: ${new Date(d.generatedAt).toLocaleString('en-IN')}`;

    // Enable buttons
    document.getElementById('btn-pdf').disabled   = false;
    document.getElementById('btn-share').disabled = false;

    // Indicator helper
    function indCls(val, goodThresh, warnThresh, invert = false) {
      if (!invert) {
        if (val >= goodThresh) return 'rp-ind-green';
        if (val >= warnThresh) return 'rp-ind-amber';
        return 'rp-ind-red';
      } else {
        if (val <= goodThresh) return 'rp-ind-green';
        if (val <= warnThresh) return 'rp-ind-amber';
        return 'rp-ind-red';
      }
    }
    function badgeCls(val, goodThresh, warnThresh, invert = false) {
      const c = indCls(val, goodThresh, warnThresh, invert);
      return c === 'rp-ind-green' ? 'background:#bbf7d0;color:#166534'
           : c === 'rp-ind-amber' ? 'background:#fde68a;color:#92400e'
           : 'background:#fecdd3;color:#9f1239';
    }
    function badgeLabel(val, good, warn, labels, invert=false) {
      const c = indCls(val, good, warn, invert);
      return c === 'rp-ind-green' ? labels[0] : c === 'rp-ind-amber' ? labels[1] : labels[2];
    }

    el.innerHTML = `

<!-- ── Score + KPIs ── -->
<div class="rp-card">
  <div class="rp-card-title">📊 Financial Score Card</div>
  <div class="rp-score-wrap">
    <div class="rp-score-ring-outer">
      <svg width="130" height="130" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" stroke-width="10"/>
        <circle cx="60" cy="60" r="54" fill="none" stroke="${color}" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="${fill} ${circ}"
          style="transition:stroke-dasharray 1.2s ease"/>
      </svg>
      <div class="rp-score-inner">
        <div class="rp-score-num" style="color:${color}">${d.score}</div>
        <div class="rp-score-denom">/100</div>
      </div>
    </div>
    <div>
      <div class="rp-risk-pill" style="background:${color}18;color:${color};border:1.5px solid ${color}40">
        ${d.riskLevel} Risk
      </div>
      <p class="rp-score-description mt-2">${d.scoreDescription || ''}</p>
    </div>
  </div>
</div>

<!-- ── KPI Grid ── -->
<div class="rp-kpi-grid mb-3">
  ${[
    { label:'Total Assets',      val:inr(m.totalAssets),      color:'rp-green' },
    { label:'Total Liabilities', val:inr(m.totalLiabilities), color:'rp-red'   },
    { label:'Net Worth',         val:inr(m.netWorth),          color: m.netWorth>=0?'rp-violet':'rp-red' },
    { label:'Monthly Income',    val:inr(m.monthlyIncome),     color:'rp-green' },
    { label:'Monthly Expenses',  val:inr(m.monthlyExpense),    color:'rp-amber' },
    { label:'Savings Rate',      val:pct(m.savingsRate),       color: m.savingsRate>=20?'rp-green':m.savingsRate>=10?'rp-amber':'rp-red' },
  ].map(k => `
    <div class="rp-kpi">
      <div class="rp-kpi-label">${k.label}</div>
      <div class="rp-kpi-val ${k.color}">${k.val}</div>
    </div>`).join('')}
</div>

<!-- ── Risk Indicators ── -->
<div class="rp-card">
  <div class="rp-card-title">⚠ Risk Indicators</div>
  ${[
    { icon:'🛡️', label:'Emergency Fund', val:`${(m.efMonths||0).toFixed(1)} months`,
      sub:inr(m.liquidAssets)+' liquid',
      cls: indCls(m.efMonths,6,3), badge: badgeLabel(m.efMonths,6,3,['Healthy','Warning','Critical']),
      bStyle: badgeCls(m.efMonths,6,3) },
    { icon:'⚖️', label:'Debt-to-Income Ratio', val:pct(m.dtiRatio),
      sub:inr(m.totalLiabilities)+' outstanding',
      cls: indCls(m.dtiRatio,0,20,true), badge: badgeLabel(m.dtiRatio,0,20,['Safe','Moderate','High Risk'],true),
      bStyle: badgeCls(m.dtiRatio,0,20,true) },
    { icon:'💰', label:'Savings Rate', val:pct(m.savingsRate),
      sub:`${inr(m.monthlyIncome - m.monthlyExpense)}/mo saved`,
      cls: indCls(m.savingsRate,20,10), badge: badgeLabel(m.savingsRate,20,10,['Strong','Average','Low']),
      bStyle: badgeCls(m.savingsRate,20,10) },
    { icon:'📈', label:'Portfolio Concentration', val:pct(m.topAssetPct)+' in '+m.topAssetClass,
      sub:'Max % in one class',
      cls: indCls(m.topAssetPct,0,40,true), badge: badgeLabel(m.topAssetPct,0,40,['Diversified','Moderate','Concentrated'],true),
      bStyle: badgeCls(m.topAssetPct,0,40,true) },
  ].map(r => `
    <div class="rp-indicator ${r.cls}">
      <span class="rp-ind-icon">${r.icon}</span>
      <div style="flex:1">
        <div class="rp-ind-label">${r.label}</div>
        <div class="rp-ind-val">${r.val}</div>
        <div style="font-size:.72rem;color:#94a3b8;margin-top:1px">${r.sub}</div>
      </div>
      <span class="rp-ind-badge" style="${r.bStyle}">${r.badge}</span>
    </div>`).join('')}
</div>

<!-- ── AI Guidance ── -->
<div class="rp-card">
  <div class="rp-card-title">🤖 AI Financial Guidance</div>
  ${ai.positives?.length ? `
  <div class="rp-ai-section">
    <div class="rp-ai-section-label rp-green">✓ What's Going Well</div>
    ${ai.positives.map(p => `<div class="rp-ai-item pos"><span class="rp-ai-bullet">✓</span>${p}</div>`).join('')}
  </div>` : ''}
  ${ai.negatives?.length ? `
  <div class="rp-ai-section">
    <div class="rp-ai-section-label rp-red">✗ Areas Needing Attention</div>
    ${ai.negatives.map(p => `<div class="rp-ai-item neg"><span class="rp-ai-bullet">!</span>${p}</div>`).join('')}
  </div>` : ''}
  ${ai.suggestions?.length ? `
  <div class="rp-ai-section">
    <div class="rp-ai-section-label rp-violet">→ Suggestions</div>
    ${ai.suggestions.map(p => `<div class="rp-ai-item sug"><span class="rp-ai-bullet">→</span>${p}</div>`).join('')}
  </div>` : ''}
</div>

<!-- ── Top Risks ── -->
${d.topRisks?.length ? `
<div class="rp-card">
  <div class="rp-card-title">🚨 Top Identified Risks</div>
  ${d.topRisks.map((r,i) => `
    <div class="rp-risk-item">
      <div class="rp-risk-num">${i+1}</div>
      <div>${r}</div>
    </div>`).join('')}
</div>` : ''}

<!-- ── Charts ── -->
<div class="row g-3 mb-3">
  <div class="col-lg-8">
    <div class="rp-card">
      <div class="rp-card-title">📈 Net Worth History</div>
      <div class="rp-chart-wrap" style="height:220px"><canvas id="rp-nw-chart"></canvas></div>
    </div>
  </div>
  <div class="col-lg-4">
    <div class="rp-card">
      <div class="rp-card-title">🥧 Asset Allocation</div>
      <div class="rp-chart-wrap" style="height:220px"><canvas id="rp-alloc-chart"></canvas></div>
    </div>
  </div>
</div>

<!-- ── Action Plans ── -->
<div class="row g-3 mb-3">
  <div class="col-md-6">
    <div class="rp-card">
      <div class="rp-card-title">📅 Next 30 Days</div>
      ${(d.next30Days||[]).map((s,i) => `
        <div class="rp-step">
          <div class="rp-step-num">${i+1}</div>
          <div>${s}</div>
        </div>`).join('')}
    </div>
  </div>
  <div class="col-md-6">
    <div class="rp-card">
      <div class="rp-card-title">🚀 Next 90 Days</div>
      ${(d.next90Days||[]).map((s,i) => `
        <div class="rp-step">
          <div class="rp-step-num">${i+1}</div>
          <div>${s}</div>
        </div>`).join('')}
    </div>
  </div>
</div>

<!-- ── Goal Progress ── -->
${d.goals?.length ? `
<div class="rp-card">
  <div class="rp-card-title">🏆 Goal Progress</div>
  <table class="rp-table">
    <thead><tr>
      <th>Goal</th><th>Target</th><th>Current</th><th>Progress</th><th>Status</th>
    </tr></thead>
    <tbody>
      ${d.goals.map(g => {
        const p = Math.min(100,(+g.current_amount/+g.target_amount)*100)||0;
        const st = p>=100?'Done':p>=50?'On Track':'Behind';
        const sc = p>=100?'rp-green':p>=50?'rp-amber':'rp-red';
        return `<tr>
          <td><strong>${g.goal_name}</strong></td>
          <td>${inr(g.target_amount)}</td>
          <td>${inr(g.current_amount)}</td>
          <td style="min-width:120px">
            <div class="rp-progress"><div class="rp-progress-bar" style="width:${p}%;background:${p>=100?'#10b981':p>=50?'#f59e0b':'#ef4444'}"></div></div>
            <small style="color:#94a3b8">${p.toFixed(0)}%</small>
          </td>
          <td class="${sc} fw-bold">${st}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- ── Footer disclaimer ── -->
<div style="text-align:center;padding:16px 0 8px;font-size:.75rem;color:#94a3b8">
  MyWealth OS • AI Financial Report • This report is for personal reference only and does not constitute financial advice.
</div>
`;

    // Render charts
    this._renderCharts(d);
  },

  _renderCharts(d) {
    // Net worth history
    const snaps = d.snapshotChart || [];
    if (snaps.length) {
      mkChart('rp-nw-chart', {
        type: 'line',
        data: {
          labels: snaps.map(s => s.month),
          datasets: [{
            label:           'Net Worth',
            data:            snaps.map(s => s.net_worth),
            borderColor:     '#7c3aed',
            backgroundColor: 'rgba(124,58,237,.1)',
            borderWidth:     2.5,
            tension:         0.4,
            fill:            true,
            pointRadius:     3,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label: ctx=>`Net Worth: ${inr(ctx.raw)}` }}},
          scales: {
            x: { grid:{ display:false } },
            y: { grid:{ color:'#f1f5f9' }, ticks:{ callback: v=>inr(v) }},
          },
        },
      });
    }

    // Asset allocation doughnut
    const alloc = d.assetAllocation || [];
    if (alloc.length) {
      const COLORS = ['#6366f1','#8b5cf6','#f59e0b','#10b981','#0ea5e9','#ef4444','#f97316','#6b7280'];
      mkChart('rp-alloc-chart', {
        type: 'doughnut',
        data: {
          labels: alloc.map(a => (a.asset_class||'').replace(/_/g,' ')),
          datasets: [{
            data:            alloc.map(a => a.value),
            backgroundColor: alloc.map((_,i) => COLORS[i%COLORS.length]),
            borderColor:     '#fff',
            borderWidth:     2,
            hoverOffset:     6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend:{ display:true, position:'right', labels:{ boxWidth:10, padding:10, font:{ size:10 }}},
            tooltip:{ callbacks:{ label: ctx=>`${ctx.label}: ${inr(ctx.raw)}` }},
          },
        },
      });
    }
  },
};

// Auto-load on page open
document.addEventListener('DOMContentLoaded', () => Report.load());
