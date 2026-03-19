'use strict';
Router.register('transactions', () => Transactions.render());

const Transactions = {
  _page: 1, _type: 'all', _cat: 'all',

  render() {
    document.getElementById('page-container').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Cash Flow</h1><p class="page-sub" id="tx-sub"></p></div>
        <button class="btn btn-primary" onclick="Transactions.openAdd()">+ Add Transaction</button>
      </div>
      <div class="grid-3" id="tx-kpis" style="margin-bottom:14px"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div class="filter-chips" style="margin-bottom:0">
          ${['all','income','expense'].map(t=>`<button class="chip ${this._type===t?'active':''}" onclick="Transactions.setType('${t}')">${t==='all'?'All':t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join('')}
        </div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Notes</th><th style="text-align:right">Amount</th><th></th></tr></thead>
        <tbody id="tx-tbody"></tbody></table>
        <div id="tx-pagination"></div>
      </div>`;
    this.load();
  },

  async load() {
    const params = { page: this._page, limit: 25 };
    if (this._type !== 'all') params.type = this._type;
    try {
      const { data, pagination, summary } = await API.transactions(params);
      document.getElementById('tx-sub').textContent = `${pagination.total} transactions`;
      document.getElementById('tx-kpis').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total Income</div><div class="stat-val c-green mono">${inr(summary.totalIncome)}</div></div>
        <div class="stat-card"><div class="stat-label">Total Expense</div><div class="stat-val c-red mono">${inr(summary.totalExpense)}</div></div>
        <div class="stat-card"><div class="stat-label">Net Savings</div><div class="stat-val ${summary.net>=0?'c-violet':'c-red'} mono">${inr(summary.net)}</div></div>`;

      document.getElementById('tx-tbody').innerHTML = data.length ? data.map(t => `
        <tr>
          <td class="mono c-muted" style="font-size:11px">${dateStr(t.date)}</td>
          <td><span class="badge ${t.type==='income'?'badge-success':'badge-danger'}">${t.type}</span></td>
          <td><span style="background:var(--bg3);border-radius:8px;padding:2px 8px;font-size:11px;text-transform:capitalize">${t.category}</span></td>
          <td style="color:var(--text3);font-size:11px">${t.notes||'—'}</td>
          <td style="text-align:right" class="mono ${t.type==='income'?'c-green':'c-red'}">${t.type==='income'?'+':'−'}${inr(t.amount,false)}</td>
          <td><button class="btn btn-danger btn-sm btn-icon" onclick="Transactions.del('${t.id}')">✕</button></td>
        </tr>`).join('')
        : `<tr><td colspan="6" class="table-empty">No transactions found</td></tr>`;

      // Pagination
      const { page, pages, total } = pagination;
      document.getElementById('tx-pagination').innerHTML = pages > 1 ? `
        <div class="pagination">
          <span>${(page-1)*25+1}–${Math.min(page*25,total)} of ${total}</span>
          <div class="page-btns">
            <button class="page-btn" ${page===1?'disabled':''} onclick="Transactions.setPage(${page-1})">←</button>
            ${Array.from({length:Math.min(5,pages)},(_,i)=>i+1).map(p=>`<button class="page-btn${p===page?' active':''}" onclick="Transactions.setPage(${p})">${p}</button>`).join('')}
            <button class="page-btn" ${page===pages?'disabled':''} onclick="Transactions.setPage(${page+1})">→</button>
          </div>
        </div>` : '';
    } catch (err) { Toast.show(err.message,'error'); }
  },

  setType(t) { this._type = t; this._page = 1; qsa('.filter-chips .chip').forEach(c=>c.classList.toggle('active',c.textContent===((t==='all'?'All':t.charAt(0).toUpperCase()+t.slice(1))))); this.load(); },
  setPage(p) { this._page = p; this.load(); },

  openAdd() {
    const inCats  = ['salary','freelance','rental','dividends','interest','other'];
    const expCats = ['rent','groceries','transport','shopping','utilities','insurance','education','medical','entertainment','travel','investments','other'];
    Modal.open('Add Transaction', `
      <div style="display:flex;gap:8px;margin-bottom:14px" id="tx-type-btns">
        <button class="btn btn-outline" style="flex:1" id="btn-income"  onclick="Transactions._setType('income')" >Income</button>
        <button class="btn btn-primary" style="flex:1" id="btn-expense" onclick="Transactions._setType('expense')">Expense</button>
      </div>
      <input type="hidden" id="f-type" value="expense"/>
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-select" id="f-cat">
          ${expCats.map(c=>`<option value="${c}">${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Amount (₹)</label><input type="number" class="form-input" id="f-amt" min="0.01" step="1"/></div>
        <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" id="f-date" value="${new Date().toISOString().split('T')[0]}"/></div>
      </div>
      <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="f-notes" placeholder="Optional"/></div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="Transactions.save()">Add</button>
      </div>`,
    { inCats, expCats });
    this._incCats = inCats; this._expCats = expCats;
  },

  _setType(t) {
    qs('#f-type').value = t;
    qs('#btn-income').className  = `btn ${t==='income'?'btn-primary':'btn-outline'}`;
    qs('#btn-expense').className = `btn ${t==='expense'?'btn-primary':'btn-outline'}`;
    const cats = t==='income' ? this._incCats : this._expCats;
    qs('#f-cat').innerHTML = cats.map(c=>`<option value="${c}">${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('');
  },

  async save() {
    const d = { type:qs('#f-type').value, category:qs('#f-cat').value, amount:+qs('#f-amt').value, date:qs('#f-date').value, notes:qs('#f-notes').value.trim(), recurring:false };
    if (!d.amount) { Toast.show('Amount required','error'); return; }
    try { await API.createTx(d); Modal.close(); Toast.show('Transaction added'); this.load(); }
    catch (err) { Toast.show(err.message,'error'); }
  },

  del(id) {
    Confirm('Delete this transaction?', async () => {
      try { await API.deleteTx(id); Toast.show('Transaction deleted','warning'); this.load(); }
      catch (err) { Toast.show(err.message,'error'); }
    });
  },
};
