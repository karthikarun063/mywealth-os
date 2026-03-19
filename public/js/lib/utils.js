'use strict';
/* ── Formatting ─────────────────────────────────────────────── */
function inr(v, compact = true) {
  const abs = Math.abs(+v || 0);
  let s;
  if (compact) {
    s = abs >= 1e7 ? `${(abs/1e7).toFixed(2)}Cr`
      : abs >= 1e5 ? `${(abs/1e5).toFixed(1)}L`
      : abs >= 1e3 ? `${(abs/1e3).toFixed(1)}K`
      : `${Math.round(abs)}`;
  } else {
    s = new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(abs);
    return v < 0 ? `−${s.replace('₹','')}₹` : s;
  }
  return (v < 0 ? '−' : '') + '₹' + s;
}

function pct(v, d = 1) {
  const n = +v || 0;
  return `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
}

function dateStr(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function prevMonth() {
  const d = new Date(); d.setMonth(d.getMonth()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function monthLabel(ym) {
  if (!ym) return '';
  const [y,m] = ym.split('-');
  return new Date(+y,+m-1,1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
}

/* ── Finance math ───────────────────────────────────────────── */
function sipFV(monthly, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (!r) return monthly * n;
  return monthly * ((Math.pow(1+r,n)-1)/r) * (1+r);
}

function fireCorpus(annualExp, wr = 4) {
  return (annualExp * 100) / wr;
}

/* ── Asset class metadata ────────────────────────────────────── */
const ASSET_LABELS = {
  stocks:'Stocks', mutual_funds:'Mutual Funds', etf:'ETF',
  crypto:'Crypto', bank_account:'Bank Account', cash:'Cash',
  fixed_deposit:'Fixed Deposit', epf:'EPF', ppf:'PPF',
  nps:'NPS', gold:'Gold', real_estate:'Real Estate',
  vehicle:'Vehicle', foreign_assets:'Foreign Assets', others:'Others',
};

const ASSET_COLORS = {
  stocks:'#6366f1', mutual_funds:'#8b5cf6', etf:'#a78bfa',
  crypto:'#f59e0b', bank_account:'#10b981', cash:'#34d399',
  fixed_deposit:'#06b6d4', epf:'#0ea5e9', ppf:'#3b82f6',
  nps:'#6366f1', gold:'#f59e0b', real_estate:'#ef4444',
  vehicle:'#f97316', foreign_assets:'#ec4899', others:'#6b7280',
};

const ASSET_CLASSES = Object.keys(ASSET_LABELS);
const GOAL_ICONS = { emergency_fund:'🛡️', retirement:'🌅', house:'🏠', education:'🎓', travel:'✈️', other:'🎯' };

/* ── DOM helpers ────────────────────────────────────────────── */
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function setHTML(id, html) {
  const e = document.getElementById(id);
  if (e) e.innerHTML = html;
}

function colorDot(color) {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>`;
}

function badge(text, type = 'info') {
  return `<span class="badge badge-${type}">${text}</span>`;
}

function severityBadge(sev) {
  const map = { critical:'danger', warning:'warning', good:'success', info:'info' };
  return badge(sev.toUpperCase(), map[sev] || 'info');
}
