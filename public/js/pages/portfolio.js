'use strict';
Router.register('portfolio', async () => {
  document.getElementById('page-container').innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Portfolio Optimizer</h1><p class="page-sub">Allocation analysis · concentration detection · rebalancing plan</p></div>
    </div>
    <div class="grid-4" id="po-kpis" style="margin-bottom:14px"></div>
    <div id="po-warnings" style="margin-bottom:14px"></div>
    <div class="grid-2" style="margin-bottom:14px">
      <div class="card"><div class="section-title">Current Allocation</div><div class="chart-wrap" style="height:220px"><canvas id="po-pie"></canvas></div></div>
      <div class="card">
        <div class="section-title">Asset Class Breakdown</div>
        <div id="po-alloc-bars"></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div class="section-title" style="margin-bottom:12px">Target Profile</div>
      <div id="po-profiles" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px"></div>
      <div class="grid-2">
        <div><div class="section-title">Current vs Target</div><div class="chart-wrap" style="height:200px"><canvas id="po-compare"></canvas></div></div>
        <div><div class="section-title">Gap Analysis</div><div class="table-wrap"><table><thead><tr><th>Category</th><th>Current</th><th>Target</th><th>Gap</th><th>Status</th></tr></thead><tbody id="po-gaps"></tbody></table></div></div>
      </div>
    </div>
    <div id="po-rebalance"></div>`;

  await Portfolio.load();
});

const Portfolio = {
  _assets: [], _profile: 'balanced',
  _models: {
    aggressive:   { equity:70, gold:10, debt:15, cash:5,  label:'Aggressive 🚀', risk:8 },
    balanced:     { equity:50, gold:15, debt:25, cash:10, label:'Balanced ⚖️',     risk:5 },
    conservative: { equity:30, gold:20, debt:40, cash:10, label:'Conservative 🛡️', risk:3 },
  },
  _catMap: {
    equity:  ['stocks','mutual_funds','etf','foreign_assets'],
    debt:    ['fixed_deposit','epf','ppf','nps'],
    gold:    ['gold'],
    cash:    ['bank_account','cash'],
    crypto:  ['crypto'],
    property:['real_estate'],
  },
  _colors: { equity:'#6366f1', debt:'#0ea5e9', gold:'#f59e0b', cash:'#10b981', crypto:'#f97316', property:'#ef4444', other:'#6b7280' },

  async load() {
    try {
      const { data } = await API.assets();
      this._assets = data;
      this.render();
    } catch (err) { Toast.show(err.message,'error'); }
  },

  render() {
    const total = this._assets.reduce((s,a)=>s+ +a.current_value,0);
    if (!total) { qs('#po-kpis').innerHTML=`<div class="card" style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text3)">Add assets to see portfolio analysis.</div>`; return; }

    // Category totals
    const cats = {};
    this._assets.forEach(a=>{
      let cat='other';
      for(const[c,cls]of Object.entries(this._catMap)) if(cls.includes(a.asset_class)){cat=c;break;}
      cats[cat]=(cats[cat]||0)+ +a.current_value;
    });
    const catArr = Object.entries(cats).map(([c,v])=>({cat:c,val:v,pct:(v/total)*100})).sort((a,b)=>b.val-a.val);

    // Risk score
    const RISK={equity:8,debt:3,gold:5,crypto:10,property:5,cash:1,other:4};
    const risk = catArr.reduce((s,c)=>(s+(c.pct/100)*(RISK[c.cat]||4)),0);

    // Diversification score (HHI-based)
    const hhi = catArr.reduce((s,c)=>s+Math.pow(c.pct,2),0);
    const divScore = Math.max(0,Math.min(100,Math.round(100-(hhi/100))));

    document.getElementById('po-kpis').innerHTML=[
      ['Portfolio Value',inr(total),'c-green'],
      [`Risk Score`,`${risk.toFixed(1)}/10`,risk>7?'c-red':risk>5?'c-amber':'c-green'],
      ['Diversification',`${divScore}/100`,divScore>=60?'c-green':divScore>=35?'c-amber':'c-red'],
      ['Asset Classes',`${catArr.length} categories`,'c-violet'],
    ].map(([l,v,c])=>`<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-val ${c} mono">${v}</div></div>`).join('');

    // Concentration warnings
    const warns=[];
    catArr.forEach(c=>{if(c.pct>70)warns.push({sev:'critical',msg:`${c.cat} dominates ${c.pct.toFixed(0)}% of portfolio — high concentration risk.`})});
    catArr.forEach(c=>{if(c.pct>50&&c.pct<=70)warns.push({sev:'warning',msg:`${c.cat} is ${c.pct.toFixed(0)}% of portfolio — consider diversifying.`})});
    this._assets.forEach(a=>{const p=(+a.current_value/total)*100;if(p>30)warns.push({sev:'warning',msg:`Single holding "${a.name}" is ${p.toFixed(0)}% of portfolio (>${30}% threshold).`})});
    document.getElementById('po-warnings').innerHTML=warns.map(w=>`
      <div class="insight-card ${w.sev}" style="margin-bottom:6px">
        <div class="insight-icon">${w.sev==='critical'?'🚨':'⚠️'}</div>
        <div class="insight-msg" style="margin:0">${w.msg}</div>
      </div>`).join('');

    // Doughnut chart
    Charts.doughnut('po-pie', catArr.map(c=>c.cat), catArr.map(c=>c.val), catArr.map(c=>this._colors[c.cat]||'#6b7280'));

    // Allocation bars
    document.getElementById('po-alloc-bars').innerHTML=catArr.map(c=>`
      <div class="alloc-row">
        <div class="alloc-dot" style="background:${this._colors[c.cat]||'#6b7280'}"></div>
        <div class="alloc-name">${c.cat}</div>
        <div class="alloc-bar-wrap"><div class="alloc-bar" style="width:${c.pct}%;background:${this._colors[c.cat]||'#6b7280'}"></div></div>
        <div class="alloc-pct">${c.pct.toFixed(1)}%</div>
        <div style="font-size:10px;color:var(--text3);width:60px;text-align:right">${inr(c.val)}</div>
      </div>`).join('');

    // Profile cards
    document.getElementById('po-profiles').innerHTML=Object.entries(this._models).map(([k,m])=>`
      <button onclick="Portfolio.setProfile('${k}')" style="text-align:left;background:${this._profile===k?'rgba(124,58,237,.12)':'var(--bg2)'};border:1px solid ${this._profile===k?'rgba(124,58,237,.4)':'var(--border)'};border-radius:12px;padding:12px;cursor:pointer;transition:all .12s">
        <div style="font-weight:700;color:${this._profile===k?'#c4b5fd':'#f1f5f9'};margin-bottom:4px">${m.label}</div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:8px">Risk ${m.risk}/10</div>
        ${['equity','debt','gold','cash'].map(cat=>`<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="color:var(--text3)">${cat}</span><span style="color:#f1f5f9;font-weight:600">${m[cat]}%</span></div>`).join('')}
        ${this._profile===k?'<div style="margin-top:8px"><span class="badge badge-info">ACTIVE</span></div>':''}
      </button>`).join('');

    this.renderGaps(catArr, total);
  },

  setProfile(p) { this._profile=p; this.render(); },

  renderGaps(catArr, total) {
    const model = this._models[this._profile];
    const catMap = Object.fromEntries(catArr.map(c=>[c.cat,c]));
    const gaps   = ['equity','debt','gold','cash'].map(cat=>({
      cat, cur:catMap[cat]?.pct||0, tgt:model[cat]||0, gap:(catMap[cat]?.pct||0)-(model[cat]||0)
    }));

    // Comparison bar chart
    Charts.groupedBar('po-compare',
      gaps.map(g=>g.cat),
      [
        { label:'Current', data:gaps.map(g=>parseFloat(g.cur.toFixed(1))), color:'#6366f1' },
        { label:'Target',  data:gaps.map(g=>g.tgt), color:'#1e293b', borderColor:'#334155', borderWidth:1 },
      ],
      { options:{ scales:{ y:{ ticks:{ callback:v=>`${v}%` } } } }});

    // Gap table
    document.getElementById('po-gaps').innerHTML=gaps.map(g=>{
      const dir=Math.abs(g.gap)<2?'on_target':g.gap>0?'overweight':'underweight';
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:${this._colors[g.cat]||'#6b7280'}"></div>${g.cat}</div></td>
        <td class="mono">${g.cur.toFixed(1)}%</td>
        <td class="mono c-muted">${g.tgt}%</td>
        <td class="mono ${dir==='on_target'?'c-green':dir==='overweight'?'c-red':'c-amber'}">${g.gap>0?'+':''}${g.gap.toFixed(1)}%</td>
        <td><span class="badge ${dir==='on_target'?'badge-success':dir==='overweight'?'badge-danger':'badge-warning'}">${dir.replace('_',' ')}</span></td>
      </tr>`;
    }).join('');

    // Rebalance plan
    const INSTRUMENTS={equity:'Nifty 50 ETF / Index Fund',debt:'PPF / Debt Mutual Fund',gold:'Sovereign Gold Bond',cash:'Liquid Fund / FD'};
    const sell=gaps.filter(g=>g.gap>2), buy=gaps.filter(g=>g.gap<-2);
    document.getElementById('po-rebalance').innerHTML=`
      <div style="margin-bottom:12px"><h2 style="font-size:15px;font-weight:700;color:#f1f5f9">Rebalancing Plan <span style="font-size:11px;color:var(--text3);font-weight:400">vs ${this._models[this._profile].label}</span></h2></div>
      ${sell.length?`<div style="font-size:10px;color:#f87171;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Step 1 — Reduce</div>
        <div class="grid-2" style="margin-bottom:14px">${sell.map(g=>`<div class="rebalance-card sell"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-weight:600;color:#f1f5f9;text-transform:capitalize">${g.cat}</span><span style="font-size:11px;font-weight:700;color:#f87171">↓ SELL</span></div><div style="font-size:22px;font-weight:900;color:#f87171;font-variant-numeric:tabular-nums">−${inr((g.gap/100)*total)}</div><div style="font-size:10px;color:var(--text3);margin-top:4px">${g.cur.toFixed(0)}% → ${g.tgt}% target</div></div>`).join('')}</div>`:''}
      ${buy.length?`<div style="font-size:10px;color:#34d399;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Step 2 — Reinvest</div>
        <div class="grid-2">${buy.map(g=>`<div class="rebalance-card buy"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-weight:600;color:#f1f5f9;text-transform:capitalize">${g.cat}</span><span style="font-size:11px;font-weight:700;color:#34d399">↑ BUY</span></div><div style="font-size:22px;font-weight:900;color:#34d399;font-variant-numeric:tabular-nums">+${inr((-g.gap/100)*total)}</div><div style="font-size:10px;color:var(--text3);margin-top:4px">${g.cur.toFixed(0)}% → ${g.tgt}% target</div><div style="font-size:10px;color:var(--text3);margin-top:2px">via: ${INSTRUMENTS[g.cat]||'Diversified fund'}</div></div>`).join('')}</div>`:''}
      ${!sell.length&&!buy.length?`<div class="card" style="text-align:center;padding:24px;color:var(--text3)">🎯 Portfolio well aligned with ${this._models[this._profile].label} target!</div>`:''}
      <div style="margin-top:14px;padding:12px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;font-size:11px;color:var(--text3);line-height:1.7">
        ⚠ These are model-based suggestions and do not constitute financial advice. Consider LTCG/STCG tax implications and exit loads before rebalancing.
      </div>`;
  },
};
