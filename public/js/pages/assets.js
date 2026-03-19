'use strict';
Router.register('assets', async () => {
  const c = document.getElementById('page-container');
  c.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Assets</h1><p class="page-sub" id="assets-sub">Loading…</p></div>
      <button class="btn btn-primary" onclick="Assets.openAdd()">+ Add Asset</button>
    </div>
    <div class="grid-3" id="assets-kpis" style="margin-bottom:14px"></div>
    <div class="filter-chips" id="asset-filters"></div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap"><table>
        <thead><tr><th>Asset</th><th>Class</th><th>Invested</th><th>Current</th><th>P&amp;L</th><th>Alloc</th><th></th></tr></thead>
        <tbody id="assets-tbody"><tr>${skeletonRows(1)}</tr></tbody>
      </table></div>
    </div>`;

  await Assets.load();
});

const Assets = {
  _all: [], _filter: 'all',

  async load() {
    try {
      const { data, summary } = await API.assets();
      this._all = data;

      document.getElementById('assets-sub').textContent = `${data.length} holdings`;
      const gain = +summary.gain;
      document.getElementById('assets-kpis').innerHTML = `
        <div class="stat-card"><div class="stat-label">Portfolio Value</div><div class="stat-val c-green mono">${inr(summary.total)}</div></div>
        <div class="stat-card"><div class="stat-label">Invested</div><div class="stat-val mono">${inr(summary.totalPurchase)}</div></div>
        <div class="stat-card"><div class="stat-label">Unrealised P&amp;L</div><div class="stat-val ${gain>=0?'c-green':'c-red'} mono">${gain>=0?'+':''}${inr(gain)}</div><div class="stat-sub">${((gain/summary.totalPurchase)*100).toFixed(2)}%</div></div>`;

      // Class filters
      const classes = [...new Set(data.map(a => a.asset_class))];
      document.getElementById('asset-filters').innerHTML =
        ['all',...classes].map(cls =>
          `<button class="chip ${this._filter===cls?'active':''}" onclick="Assets.setFilter('${cls}')">${cls==='all'?'All':ASSET_LABELS[cls]||cls}</button>`
        ).join('');

      this.renderTable(summary.total);
    } catch (err) { Toast.show(err.message,'error'); }
  },

  setFilter(cls) {
    this._filter = cls;
    qsa('#asset-filters .chip').forEach(c => c.classList.toggle('active', c.textContent===(cls==='all'?'All':ASSET_LABELS[cls]||cls)));
    const { data, summary } = { data: this._all, summary: { total: this._all.reduce((s,a)=>s+ +a.current_value,0) }};
    this.renderTable(summary.total);
  },

  renderTable(total) {
    const filtered = this._all.filter(a => this._filter==='all' || a.asset_class===this._filter)
                               .sort((a,b) => b.current_value - a.current_value);
    if (!filtered.length) {
      document.getElementById('assets-tbody').innerHTML = `<tr><td colspan="7" class="table-empty">No assets found</td></tr>`;
      return;
    }
    document.getElementById('assets-tbody').innerHTML = filtered.map(a => {
      const cv  = +a.current_value, pv = +a.purchase_value;
      const ret = cv - pv, retPct = pv>0?(ret/pv)*100:0;
      const alloc = total>0?(cv/total)*100:0;
      const color = ASSET_COLORS[a.asset_class]||'#6b7280';
      return `<tr>
        <td><div style="font-weight:600;color:#f1f5f9">${a.name}</div>${a.notes?`<div style="font-size:11px;color:var(--text3)">${a.notes}</div>`:''}</td>
        <td><span style="background:${color}20;color:${color};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600">${ASSET_LABELS[a.asset_class]||a.asset_class}</span></td>
        <td class="mono c-muted">${inr(pv)}</td>
        <td class="mono" style="font-weight:600;color:#f1f5f9">${inr(cv)}</td>
        <td><div class="mono ${ret>=0?'c-green':'c-red'}" style="font-weight:700">${ret>=0?'+':''}${inr(ret)}</div><div style="font-size:10px;color:${ret>=0?'#059669':'#dc2626'}">${ret>=0?'+':''}${retPct.toFixed(1)}%</div></td>
        <td><div style="display:flex;align-items:center;gap:6px;min-width:100px"><div style="flex:1;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden"><div style="height:100%;width:${alloc}%;background:${color};border-radius:2px"></div></div><span style="font-size:10px;color:var(--text3)">${alloc.toFixed(0)}%</span></div></td>
        <td><div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-sm btn-icon" onclick="Assets.openEdit('${a.id}')">✎</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="Assets.del('${a.id}')">✕</button>
        </div></td>
      </tr>`;
    }).join('');
  },

  openAdd() { this._openForm(); },
  openEdit(id) { this._openForm(this._all.find(a=>a.id===id)); },

  _openForm(a = null) {
    Modal.open(a ? `Edit: ${a.name}` : 'Add Asset', `
      <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="f-name" value="${a?.name||''}" placeholder="e.g. HDFC Flexi Cap Fund"/></div>
      <div class="form-group"><label class="form-label">Asset Class</label>
        <select class="form-select" id="f-cls">
          ${ASSET_CLASSES.map(c=>`<option value="${c}" ${a?.asset_class===c?'selected':''}>${ASSET_LABELS[c]}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Purchase Value (₹)</label><input type="number" class="form-input" id="f-pv" value="${a?.purchase_value||''}"/></div>
        <div class="form-group"><label class="form-label">Current Value (₹)</label><input type="number" class="form-input" id="f-cv" value="${a?.current_value||''}"/></div>
      </div>
      <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="f-notes" value="${a?.notes||''}" placeholder="Optional"/></div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="Assets.save('${a?.id||''}')">${a?'Update':'Add Asset'}</button>
      </div>`);
  },

  async save(id) {
    const d = {
      name: qs('#f-name').value.trim(),
      asset_class: qs('#f-cls').value,
      purchase_value: +qs('#f-pv').value||0,
      current_value:  +qs('#f-cv').value||0,
      currency: 'INR',
      notes: qs('#f-notes').value.trim(),
    };
    if (!d.name) { Toast.show('Name is required','error'); return; }
    try {
      if (id) await API.updateAsset(id, d); else await API.createAsset(d);
      Modal.close();
      Toast.show(id ? `"${d.name}" updated` : `"${d.name}" added`);
      await this.load();
    } catch (err) { Toast.show(err.message,'error'); }
  },

  del(id) {
    const a = this._all.find(x=>x.id===id);
    Confirm(`Delete "${a?.name}"?`, async () => {
      try { await API.deleteAsset(id); Toast.show(`"${a?.name}" removed`,'warning'); await this.load(); }
      catch (err) { Toast.show(err.message,'error'); }
    });
  },
};
