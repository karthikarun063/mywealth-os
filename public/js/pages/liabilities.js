'use strict';
Router.register('liabilities', async () => {
  document.getElementById('page-container').innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Liabilities</h1><p class="page-sub" id="liab-sub"></p></div>
      <button class="btn btn-primary" onclick="Liabs.openAdd()">+ Add Liability</button>
    </div>
    <div class="grid-3" id="liab-kpis" style="margin-bottom:14px"></div>
    <div class="card" style="padding:0;overflow:hidden">
      <table><thead><tr><th>Name</th><th>Type</th><th>Outstanding</th><th>Interest</th><th>EMI/mo</th><th>Annual Cost</th><th></th></tr></thead>
      <tbody id="liab-tbody"></tbody></table>
    </div>`;
  await Liabs.load();
});

const Liabs = {
  _all: [],
  async load() {
    try {
      const { data, summary } = await API.liabilities();
      this._all = data;
      document.getElementById('liab-sub').textContent = `${data.length} loans`;
      const annInt = data.reduce((s,l)=> s + (+l.outstanding_amount * +l.interest_rate / 100), 0);
      document.getElementById('liab-kpis').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total Debt</div><div class="stat-val c-red mono">${inr(summary.totalDebt)}</div></div>
        <div class="stat-card"><div class="stat-label">Total Monthly EMI</div><div class="stat-val c-amber mono">${inr(summary.totalEMI)}</div></div>
        <div class="stat-card"><div class="stat-label">Annual Interest Cost</div><div class="stat-val c-red mono">${inr(annInt)}</div></div>`;
      document.getElementById('liab-tbody').innerHTML = data.length ? data.sort((a,b)=>b.outstanding_amount-a.outstanding_amount).map(l=>`
        <tr>
          <td><div style="font-weight:600;color:#f1f5f9">${l.name}</div><div style="font-size:11px;color:var(--text3)">${l.lender||''}</div></td>
          <td><span style="background:var(--bg3);border-radius:8px;padding:2px 8px;font-size:11px">${l.liability_type.replace('_',' ')}</span></td>
          <td class="mono c-red">${inr(l.outstanding_amount)}</td>
          <td class="mono">${l.interest_rate}%</td>
          <td class="mono">${inr(l.emi)}</td>
          <td class="mono c-amber">${inr(+l.outstanding_amount * +l.interest_rate / 100)}</td>
          <td><div style="display:flex;gap:4px">
            <button class="btn btn-outline btn-sm btn-icon" onclick="Liabs.openEdit('${l.id}')">✎</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="Liabs.del('${l.id}')">✕</button>
          </div></td>
        </tr>`).join('')
        : `<tr><td colspan="7" class="table-empty">No liabilities</td></tr>`;
    } catch (err) { Toast.show(err.message,'error'); }
  },

  openAdd()    { this._form(); },
  openEdit(id) { this._form(this._all.find(l=>l.id===id)); },

  _form(l=null) {
    const types=['home_loan','personal_loan','education_loan','car_loan','credit_card'];
    Modal.open(l?`Edit: ${l.name}`:'Add Liability',`
      <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="f-n" value="${l?.name||''}" placeholder="e.g. Home Loan – SBI"/></div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="f-lt">${types.map(t=>`<option value="${t}" ${l?.liability_type===t?'selected':''}>${t.replace(/_/g,' ')}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Lender</label><input class="form-input" id="f-le" value="${l?.lender||''}" placeholder="Bank name"/></div>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Outstanding (₹)</label><input type="number" class="form-input" id="f-oa" value="${l?.outstanding_amount||''}"/></div>
        <div class="form-group"><label class="form-label">Interest % p.a.</label><input type="number" class="form-input" id="f-ir" value="${l?.interest_rate||''}" step="0.1"/></div>
      </div>
      <div class="form-group"><label class="form-label">Monthly EMI (₹)</label><input type="number" class="form-input" id="f-emi" value="${l?.emi||''}"/></div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="Liabs.save('${l?.id||''}')">${l?'Update':'Add'}</button>
      </div>`);
  },

  async save(id) {
    const d={name:qs('#f-n').value.trim(),liability_type:qs('#f-lt').value,lender:qs('#f-le').value.trim(),outstanding_amount:+qs('#f-oa').value,interest_rate:+qs('#f-ir').value,emi:+qs('#f-emi').value};
    if(!d.name||!d.outstanding_amount){Toast.show('Name and amount required','error');return;}
    try{if(id)await API.updateLiability(id,d);else await API.createLiability(d);Modal.close();Toast.show(id?'Updated':'Added');await Liabs.load();}
    catch(err){Toast.show(err.message,'error');}
  },

  del(id){
    const l=this._all.find(x=>x.id===id);
    Confirm(`Delete "${l?.name}"?`,async()=>{try{await API.deleteLiability(id);Toast.show('Deleted','warning');await Liabs.load();}catch(err){Toast.show(err.message,'error');}});
  },
};
