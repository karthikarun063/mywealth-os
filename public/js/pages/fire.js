'use strict';
Router.register('fire', async () => {
  let totalAssets = 0;
  try { const { data } = await API.assets(); totalAssets = data.reduce((s,a)=>s+ +a.current_value,0); } catch(e){}

  document.getElementById('page-container').innerHTML = `
    <div class="page-header"><div><h1 class="page-title">FIRE Calculator</h1><p class="page-sub">Financial Independence, Retire Early</p></div></div>
    <div class="grid-2-1">
      <div class="card">
        <div class="section-title">Parameters</div>
        <div class="form-grid-2">
          ${[['Annual Expenses (₹)','fire-exp','600000'],['Current Age','fire-age','30'],['Monthly Investment (₹)','fire-sip','30000'],['Expected Return (%)','fire-ret','12'],['Withdrawal Rate (%)','fire-wr','4']].map(([l,id,v])=>`
            <div class="form-group"><label class="form-label">${l}</label><input type="number" class="form-input" id="${id}" value="${v}" oninput="Fire.calc()"/></div>`).join('')}
        </div>
        <div class="card" style="background:var(--bg2);margin-top:4px" id="fire-results"></div>
      </div>
      <div class="card">
        <div class="section-title">Corpus Projection</div>
        <div class="chart-wrap" style="height:300px"><canvas id="fire-chart"></canvas></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px" id="fire-stats"></div>
      </div>
    </div>`;

  Fire._corpus = totalAssets;
  Fire.calc();
});

const Fire = {
  _corpus: 0,
  calc() {
    const exp = +qs('#fire-exp')?.value || 600000;
    const age = +qs('#fire-age')?.value || 30;
    const sip = +qs('#fire-sip')?.value || 30000;
    const ret = +qs('#fire-ret')?.value || 12;
    const wr  = +qs('#fire-wr')?.value  || 4;

    const required = fireCorpus(exp, wr);
    const pct      = Math.min(100, (this._corpus / required) * 100);
    let yrs = 0;
    while (yrs < 60 && this._corpus + sipFV(sip, ret, yrs) < required) yrs++;
    const fireAge = age + yrs;

    // Chart data
    const pts = Array.from({length: Math.min(yrs+8,42)}, (_,i) => ({
      y: Math.round(this._corpus + sipFV(sip, ret, i)), t: Math.round(required),
    }));

    qs('#fire-results').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div class="stat-label">Corpus Needed</div><div class="stat-val c-violet mono" style="font-size:18px">${inr(required)}</div></div>
        <div><div class="stat-label">Current Progress</div><div class="stat-val mono" style="font-size:18px">${pct.toFixed(1)}%</div></div>
      </div>
      <div class="progress-bg" style="margin:12px 0 4px"><div class="progress-bar" style="width:${pct}%;background:linear-gradient(to right,#7c3aed,#4f46e5)"></div></div>`;

    qs('#fire-stats').innerHTML = `
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div class="stat-label">FIRE Age</div><div class="stat-val c-green mono" style="font-size:32px;font-weight:900">${fireAge}</div>
        <div style="font-size:11px;color:var(--text3)">${yrs} years away</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div class="stat-label">Monthly Withdrawal</div><div class="stat-val c-amber mono" style="font-size:18px">${inr(exp/12)}</div>
        <div style="font-size:11px;color:var(--text3)">at ${wr}% withdrawal</div>
      </div>`;

    Charts.area('fire-chart',
      pts.map((_,i) => `Y${age+i}`),
      [
        { label:'Your Corpus', data:pts.map(p=>p.y), color:'#7c3aed' },
        { label:'FIRE Target',  data:pts.map(p=>p.t), color:'#f59e0b', fill:false, borderDash:[5,3] },
      ]);
  },
};
