'use strict';
Router.register('insights', async () => {
  document.getElementById('page-container').innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Financial Insights</h1><p class="page-sub">Rule-based analysis of your financial health</p></div>
      <button class="btn btn-outline" onclick="Insights.load()">↻ Refresh</button>
    </div>
    <div class="grid-4" id="ins-kpis" style="margin-bottom:16px"></div>
    <div class="grid-2" style="margin-bottom:16px">
      <div class="card"><div class="section-title">Savings Rate</div><div class="chart-wrap" style="height:180px"><canvas id="ins-sr-chart"></canvas></div></div>
      <div class="card"><div class="section-title">Emergency Fund Coverage</div><div id="ins-ef"></div></div>
    </div>
    <div class="section-title" style="margin-bottom:10px">All Insights</div>
    <div class="filter-chips" id="ins-filters"></div>
    <div id="ins-feed" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"></div>`;

  await Insights.load();
});

const Insights = {
  _all: [], _filter: 'all',
  async load() {
    try {
      const { insights, metrics } = await API.insights();
      this._all = insights;

      // KPIs
      document.getElementById('ins-kpis').innerHTML = [
        ['Savings Rate', `${metrics.savingsRate.toFixed(1)}%`, metrics.savingsRate>=25?'c-green':metrics.savingsRate>=10?'c-amber':'c-red'],
        ['Emergency Fund', `${metrics.efMonths.toFixed(1)} mo`, metrics.efMonths>=6?'c-green':metrics.efMonths>=3?'c-amber':'c-red'],
        ['Debt-to-Income', `${metrics.dti.toFixed(0)}%`, metrics.dti<20?'c-green':metrics.dti<35?'c-amber':'c-red'],
        ['Risk Score', `${metrics.riskScore.toFixed(1)}/10`, metrics.riskScore>7?'c-red':metrics.riskScore>5?'c-amber':'c-green'],
      ].map(([l,v,c])=>`<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-val ${c} mono">${v}</div></div>`).join('');

      // Savings rate gauge bar
      Charts.bar('ins-sr-chart',
        ['Poor (0–10%)', 'Average (10–25%)', 'Good (25–40%)', 'Excellent (40%+)', 'Your Rate'],
        [{ label:'Benchmark', data:[10,15,15,15,0], color:'#1e293b' },
         { label:'Your Rate', data:[0,0,0,0,Math.min(60,metrics.savingsRate)], color: metrics.savingsRate>=25?'#10b981':metrics.savingsRate>=10?'#f59e0b':'#f43f5e' }],
        { stacked:true });

      // Emergency fund visual
      const efPct = Math.min(100,(metrics.efMonths/6)*100);
      document.getElementById('ins-ef').innerHTML = `
        <div style="font-size:36px;font-weight:900;color:${metrics.efMonths>=6?'#34d399':metrics.efMonths>=3?'#fbbf24':'#f87171'};font-variant-numeric:tabular-nums;margin-bottom:8px">${metrics.efMonths.toFixed(1)}<span style="font-size:14px;font-weight:400;color:var(--text3)"> / 6 months</span></div>
        <div class="progress-bg" style="height:10px;margin-bottom:8px"><div class="progress-bar" style="width:${efPct}%;background:${metrics.efMonths>=6?'#10b981':metrics.efMonths>=3?'#f59e0b':'#f43f5e'}"></div></div>
        <p style="font-size:12px;color:var(--text3)">${metrics.efMonths>=6?'✓ Emergency fund is healthy.':metrics.efMonths>=3?'Build more — target 6 months of expenses.':'Critical: you need liquid emergency savings urgently.'}</p>
        <div style="margin-top:10px;font-size:11px;color:var(--text3)">Liquid assets: <strong style="color:#f1f5f9">${inr(metrics.liquidAssets)}</strong></div>`;

      // Filters
      const types = [...new Set(insights.map(i=>i.type))];
      document.getElementById('ins-filters').innerHTML =
        ['all',...types].map(t=>`<button class="chip ${this._filter===t?'active':''}" onclick="Insights.setFilter('${t}')">${t==='all'?'All':t.replace('_',' ')}</button>`).join('');

      this.renderFeed();
    } catch (err) { Toast.show(err.message,'error'); }
  },

  setFilter(f) {
    this._filter = f;
    qsa('#ins-filters .chip').forEach(c=>c.classList.toggle('active',c.textContent===(f==='all'?'All':f.replace('_',' '))));
    this.renderFeed();
  },

  renderFeed() {
    const shown = this._filter==='all' ? this._all : this._all.filter(i=>i.type===this._filter);
    const ICONS = { critical:'🚨', warning:'⚠️', good:'✅', info:'ℹ️' };
    document.getElementById('ins-feed').innerHTML = shown.map(ins=>`
      <div class="insight-card ${ins.severity}">
        <div class="insight-icon">${ICONS[ins.severity]||'ℹ️'}</div>
        <div style="flex:1;min-width:0">
          <div class="insight-title">
            <span>${ins.title}</span>
            ${ins.metric ? `<span style="font-variant-numeric:tabular-nums;font-size:12px;font-weight:700;color:${ins.severity==='critical'?'#f87171':ins.severity==='warning'?'#fbbf24':ins.severity==='good'?'#34d399':'#818cf8'}">${ins.metric}</span>` : ''}
          </div>
          <div class="insight-msg">${ins.message}</div>
          <div class="insight-rec">${ins.recommendation}</div>
        </div>
      </div>`).join('') || `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text3)">No insights match this filter.</div>`;
  },
};
