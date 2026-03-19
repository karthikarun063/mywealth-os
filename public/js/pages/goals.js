'use strict';
/* ── GOALS ──────────────────────────────────────────────────── */
Router.register('goals', async () => {
  const c = document.getElementById('page-container');
  c.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Financial Goals</h1><p class="page-sub">Probability engine & SIP gap analysis</p></div>
      <button class="btn btn-primary" onclick="Goals.openAdd()">+ Add Goal</button>
    </div>
    <div id="goals-grid" class="grid-2">Loading…</div>`;
  await Goals.load();
});

const Goals = {
  _all: [],
  async load() {
    try {
      this._all = await API.goals();
      if (!this._all.length) {
        document.getElementById('goals-grid').innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;padding:40px"><p class="c-muted">No goals yet. Add your first goal!</p></div>`;
        return;
      }
      document.getElementById('goals-grid').innerHTML = this._all.map(g => {
        const pct    = Math.min(100,(+g.current_amount/+g.target_amount)*100);
        const daysLeft = g.target_date ? Math.max(0,Math.ceil((new Date(g.target_date)-Date.now())/86400000)) : null;
        const yrsLeft  = daysLeft != null ? Math.max(0.01, daysLeft/365.25) : 5;
        const proj     = +g.current_amount + sipFV(+g.monthly_contribution, +g.expected_return, yrsLeft);
        const gap      = Math.max(0, +g.target_amount - proj);
        const prob     = Math.min(100, Math.round((proj/+g.target_amount)*100));
        const probBadge= prob>=80?'badge-success':prob>=50?'badge-warning':'badge-danger';
        return `<div class="card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:22px;width:36px;height:36px;background:var(--bg3);border-radius:10px;display:flex;align-items:center;justify-content:center">${GOAL_ICONS[g.goal_type]||'🎯'}</div>
              <div><div style="font-weight:700;color:#f1f5f9">${g.goal_name}</div><div style="font-size:11px;color:var(--text3)">${daysLeft!=null?`${Math.round(daysLeft/30)} months left`:'No deadline'}</div></div>
            </div>
            <span class="badge ${probBadge}">${prob}% likely</span>
          </div>
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px">
              <span class="c-muted">Saved: <strong style="color:#f1f5f9">${inr(g.current_amount)}</strong></span>
              <span class="c-muted">Target: <strong style="color:#f1f5f9">${inr(g.target_amount)}</strong></span>
            </div>
            <div class="progress-bg"><div class="progress-bar" style="width:${pct}%;background:${pct>=100?'#10b981':'linear-gradient(to right,#7c3aed,#6366f1)'}"></div></div>
            <div style="text-align:right;font-size:10px;color:var(--text3);margin-top:2px">${pct.toFixed(1)}%</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
            ${[['SIP',inr(g.monthly_contribution)],['Return',`${g.expected_return}%`],['Proj.',inr(proj)]].map(([l,v])=>`<div style="background:var(--bg2);border-radius:8px;padding:7px 8px"><div style="font-size:9px;color:var(--text3);text-transform:uppercase">${l}</div><div style="font-size:11px;font-weight:700;color:#e2e8f0;margin-top:2px">${v}</div></div>`).join('')}
          </div>
          ${gap>0?`<div style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:6px 10px;font-size:11px;color:#fbbf24;margin-bottom:10px">⚡ Shortfall: ${inr(gap)} — increase SIP to close gap</div>`:'<div style="background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:6px 10px;font-size:11px;color:#34d399;margin-bottom:10px">✓ On track!</div>'}
          <div style="display:flex;gap:6px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border)">
            <button class="btn btn-outline btn-sm" onclick="Goals.openEdit('${g.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="Goals.del('${g.id}')">Delete</button>
          </div>
        </div>`;
      }).join('');
    } catch (err) { Toast.show(err.message,'error'); }
  },

  openAdd()    { this._form(); },
  openEdit(id) { this._form(this._all.find(g=>g.id===id)); },

  _form(g = null) {
    const types = ['emergency_fund','retirement','house','education','travel','other'];
    Modal.open(g?`Edit: ${g.goal_name}`:'New Goal',`
      <div class="form-group"><label class="form-label">Goal Name</label><input class="form-input" id="f-gn" value="${g?.goal_name||''}" placeholder="e.g. Emergency Fund"/></div>
      <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="f-gt">${types.map(t=>`<option value="${t}" ${g?.goal_type===t?'selected':''}>${GOAL_ICONS[t]} ${t.replace('_',' ')}</option>`).join('')}</select></div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Target (₹)</label><input type="number" class="form-input" id="f-ta" value="${g?.target_amount||''}"/></div>
        <div class="form-group"><label class="form-label">Current (₹)</label><input type="number" class="form-input" id="f-ca" value="${g?.current_amount||0}"/></div>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Monthly SIP (₹)</label><input type="number" class="form-input" id="f-mc" value="${g?.monthly_contribution||0}"/></div>
        <div class="form-group"><label class="form-label">Return % p.a.</label><input type="number" class="form-input" id="f-er" value="${g?.expected_return||10}" step="0.5"/></div>
      </div>
      <div class="form-group"><label class="form-label">Target Date</label><input type="date" class="form-input" id="f-td" value="${g?.target_date?.split('T')[0]||''}"/></div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="Goals.save('${g?.id||''}')">${g?'Update':'Create'}</button>
      </div>`);
  },

  async save(id) {
    const d = { goal_name:qs('#f-gn').value.trim(), goal_type:qs('#f-gt').value, target_amount:+qs('#f-ta').value, current_amount:+qs('#f-ca').value, monthly_contribution:+qs('#f-mc').value, expected_return:+qs('#f-er').value, target_date:qs('#f-td').value||null };
    if (!d.goal_name||!d.target_amount) { Toast.show('Name and target are required','error'); return; }
    try {
      if (id) await API.updateGoal(id,d); else await API.createGoal(d);
      Modal.close(); Toast.show(id?'Goal updated':'Goal created'); await Goals.load();
    } catch (err) { Toast.show(err.message,'error'); }
  },

  del(id) {
    const g = this._all.find(x=>x.id===id);
    Confirm(`Delete "${g?.goal_name}"?`, async ()=>{
      try { await API.deleteGoal(id); Toast.show('Goal deleted','warning'); await Goals.load(); }
      catch (err) { Toast.show(err.message,'error'); }
    });
  },
};
