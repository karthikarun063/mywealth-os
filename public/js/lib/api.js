'use strict';
const API = {
  async _req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || `HTTP ${res.status}`);
    return data;
  },
  get:    (path)        => API._req('GET',    path),
  post:   (path, body)  => API._req('POST',   path, body),
  put:    (path, body)  => API._req('PUT',    path, body),
  delete: (path)        => API._req('DELETE', path),

  // Dashboard
  dashboard:     ()        => API.get('/dashboard'),

  // Assets
  assets:        ()        => API.get('/assets'),
  createAsset:   (d)       => API.post('/assets', d),
  updateAsset:   (id, d)   => API.put(`/assets/${id}`, d),
  deleteAsset:   (id)      => API.delete(`/assets/${id}`),

  // Liabilities
  liabilities:     ()      => API.get('/liabilities'),
  createLiability: (d)     => API.post('/liabilities', d),
  updateLiability: (id, d) => API.put(`/liabilities/${id}`, d),
  deleteLiability: (id)    => API.delete(`/liabilities/${id}`),

  // Transactions
  transactions:  (p)       => API.get('/transactions' + (p ? '?'+new URLSearchParams(p) : '')),
  txMonthlySummary: ()     => API.get('/transactions/monthly-summary'),
  txCategoryTotals: (m)    => API.get(`/transactions/category-totals?month=${m}`),
  createTx:      (d)       => API.post('/transactions', d),
  deleteTx:      (id)      => API.delete(`/transactions/${id}`),

  // Budgets — full CRUD + summary
  budgets:        (m, y)    => API.get(`/budgets?month=${m}&year=${y || ''}`),
  budgetSummary:  (m, y)    => API.get(`/budgets/summary?month=${m}&year=${y || ''}`),
  createBudget:   (d)       => API.post('/budgets', d),
  updateBudget:   (id, d)   => API.put(`/budgets/${id}`, d),
  deleteBudget:   (id)      => API.delete(`/budgets/${id}`),

  // Goals
  goals:         ()        => API.get('/goals'),
  createGoal:    (d)       => API.post('/goals', d),
  updateGoal:    (id, d)   => API.put(`/goals/${id}`, d),
  deleteGoal:    (id)      => API.delete(`/goals/${id}`),

  // Snapshots
  snapshots:     ()        => API.get('/snapshots'),
  generateSnap:  ()        => API.post('/snapshots/generate'),

  // Insights
  insights:      ()        => API.get('/insights'),
};
