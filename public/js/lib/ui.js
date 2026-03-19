'use strict';
/* ── Toast ──────────────────────────────────────────────────── */
const Toast = {
  show(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const t = el('div', `toast toast-${type}`, `<span>${type==='success'?'✓':type==='error'?'✕':'⚠'}</span>${msg}`);
    c.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  },
};

/* ── Modal ──────────────────────────────────────────────────── */
const Modal = {
  open(title, bodyHTML, opts = {}) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML    = bodyHTML;
    document.getElementById('modal').style.maxWidth    = opts.wide ? '640px' : '480px';
    document.getElementById('modal-overlay').classList.remove('hidden');
    const first = document.querySelector('#modal-body input, #modal-body select');
    if (first) setTimeout(() => first.focus(), 80);
  },
  close() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  },
};

/* ── Confirm dialog ─────────────────────────────────────────── */
function Confirm(message, onYes) {
  Modal.open('Confirm', `
    <div style="text-align:center;padding:8px 0 4px">
      <p style="color:var(--text2);font-size:14px;margin-bottom:20px">${message}</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-danger" id="confirm-yes">Yes, delete</button>
      </div>
    </div>
  `);
  document.getElementById('confirm-yes').onclick = () => { Modal.close(); onYes(); };
}

/* ── Router ─────────────────────────────────────────────────── */
const Router = {
  _current: null,
  _pages: {},

  register(name, renderFn) { this._pages[name] = renderFn; },

  go(page) {
    this._current = page;
    // Highlight nav
    qsa('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    qsa('.mobile-nav button').forEach(b => {
      const p = b.getAttribute('onclick')?.match(/go\('(\w+)'\)/)?.[1];
      if (p) b.classList.toggle('active', p === page);
    });
    // Render
    const render = this._pages[page];
    if (render) {
      document.getElementById('page-container').innerHTML = '';
      render();
    } else {
      document.getElementById('page-container').innerHTML = `<div class="card" style="text-align:center;padding:40px"><p style="color:var(--text3)">Page "${page}" not found.</p></div>`;
    }
    // Scroll to top
    document.querySelector('.main-content').scrollTop = 0;
  },

  init() {
    qsa('.nav-item').forEach(b => {
      b.addEventListener('click', () => this.go(b.dataset.page));
    });
  },
};

/* ── Skeleton loader ────────────────────────────────────────── */
function skeletonRows(n = 4) {
  return Array.from({length:n}, () =>
    `<tr>${Array.from({length:5},()=>`<td><div style="height:14px;background:var(--bg3);border-radius:4px;animation:pulse 1.5s infinite"></div></td>`).join('')}</tr>`
  ).join('');
}
