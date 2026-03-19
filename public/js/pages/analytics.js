'use strict';
Router.register('analytics', async () => {
  document.getElementById('page-container').innerHTML = `
    <div class="page-header"><div><h1 class="page-title">Analytics</h1><p class="page-sub">Portfolio performance & projections</p></div></div>
    <div class="grid-4" id="an-kpis" style="margin-bottom:14px"></div>
    <div class="grid-2" style="margin-bottom:12px">
      <div class="card"><div class="section-title">Net Worth History</div><div class="chart-wrap" style="height:200px"><canvas id="an-nw"></canvas></div></div>
      <div class="card"><div class="section-title">6-Month Cash Flow</div><div class="chart-wrap" style="height:200px"><canvas id="an-cf"></canvas></div></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="section-title">Portfolio by Class</div><div class="chart-wrap" style="height:200px"><canvas id="an-cls"></canvas></div></div>
      <div class="card">
        <div class="section-title">Wealth Projection</div>
        <div class="form-grid-2" style="margin-bottom:10px">
          <div class="form-group"><label class="form-label">Monthly SIP (₹)</label><input type="number" class="form-input" id="an-sip" value="25000" oninput="Analytics.reproject()"/></div>
          <div class="form-group"><label class="form-label">Return % p.a.</label><input type="number" class="form-input" id="an-ret" value="12" step="0.5" oninput="Analytics.reproject()"/></div>
        </div>
        <div class="chart-wrap" style="height:140px"><canvas id="an-proj"></canvas></div>
        <div id="an-proj-val" style="text-align:center;font-size:12px;color:var(--text3);margin-top:6px"></div>
      </div>
    </div>`;

  try {
    const [{ data:assets, summary }, snaps, monthly] = await Promise.all([
      API.assets(), API.snapshots(), API.txMonthlySummary(),
    ]);

    const totalC = +summary.total, totalP = +summary.totalPurchase;
    const gain   = totalC - totalP;
    const cagr   = totalP>0 ? (Math.pow(totalC/totalP, 1/3)-1)*100 : 0;

    document.getElementById('an-kpis').innerHTML = [
      ['Portfolio Value', inr(totalC), 'c-green'],
      ['3-Yr CAGR',       `${cagr.toFixed(1)}%`, 'c-violet'],
      ['Total Gain',      (gain>=0?'+':'')+inr(gain), gain>=0?'c-green':'c-red'],
      ['vs NIFTY 50',     `${(cagr-12.5)>=0?'+':''}${(cagr-12.5).toFixed(1)}%`, (cagr-12.5)>=0?'c-green':'c-red'],
    ].map(([l,v,c])=>`<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-val ${c} mono">${v}</div></div>`).join('');

    const snapsSorted = [...snaps].sort((a,b)=>a.month.localeCompare(b.month));
    Charts.area('an-nw', snapsSorted.map(s=>monthLabel(s.month)), [{ label:'Net Worth', data:snapsSorted.map(s=>+s.net_worth), color:'#7c3aed' }]);
    Charts.groupedBar('an-cf', monthly.map(m=>monthLabel(m.month)), [
      { label:'Income',  data:monthly.map(m=>+m.income),  color:'#10b981' },
      { label:'Expense', data:monthly.map(m=>+m.expense), color:'#f43f5e' },
    ]);

    const byClass = assets.reduce((acc,a)=>{acc[a.asset_class]=(acc[a.asset_class]||0)+ +a.current_value;return acc;},{});
    const cls = Object.entries(byClass).sort(([,a],[,b])=>b-a);
    Charts.horizontalBar('an-cls', cls.map(([c])=>ASSET_LABELS[c]||c), cls.map(([,v])=>v), cls.map(([c])=>ASSET_COLORS[c]||'#6b7280'));

    Analytics._base = totalC;
    Analytics.reproject();
  } catch (err) { Toast.show(err.message,'error'); }
});

const Analytics = {
  _base: 0,
  reproject() {
    const sip  = +qs('#an-sip')?.value || 25000;
    const ret  = +qs('#an-ret')?.value || 12;
    const pts  = Array.from({length:16},(_,i)=>({ y: Math.round(this._base + sipFV(sip,ret,i)) }));
    Charts.area('an-proj', pts.map((_,i)=>`Y${i}`), [{ label:'Wealth', data:pts.map(p=>p.y), color:'#10b981' }]);
    const el = qs('#an-proj-val');
    if (el) el.textContent = `In 15 years: ${inr(pts[15].y)}`;
  },
};
