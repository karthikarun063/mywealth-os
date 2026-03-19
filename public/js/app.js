'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  Router.init();
  Router.go('dashboard');

  // Keep sidebar net worth live
  async function updateSidebar() {
    try {
      const dash = await API.dashboard();
      const nw   = +dash.netWorth;
      document.getElementById('sb-nw').textContent = inr(nw);
      document.getElementById('sb-sr').textContent = `Savings: ${(+dash.savingsRate).toFixed(1)}%`;
    } catch { /* DB not connected — silent */ }
  }
  await updateSidebar();
  setInterval(updateSidebar, 30000);
});

// Dashboard PDF quick-download helper
async function dashDownloadPDF() {
  try {
    const res = await fetch('/api/report-pdf');
    const blob = await res.blob();
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `mywealth-report-${new Date().toISOString().slice(0,10)}.pdf`,
    });
    a.click();
  } catch(e) { alert('PDF failed: ' + e.message); }
}
