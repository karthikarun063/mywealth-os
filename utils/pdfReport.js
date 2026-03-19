'use strict';
const PDFDocument = require('pdfkit');

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  primary:   '#7c3aed',
  dark:      '#1e293b',
  mid:       '#475569',
  light:     '#94a3b8',
  border:    '#e2e8f0',
  green:     '#10b981',
  amber:     '#f59e0b',
  red:       '#ef4444',
  white:     '#ffffff',
  bg:        '#f8fafc',
  bgCard:    '#f1f5f9',
};

function scoreColor(score) {
  if (score >= 70) return C.green;
  if (score >= 40) return C.amber;
  return C.red;
}

function inr(n) {
  const abs = Math.abs(+n || 0);
  let s;
  if (abs >= 1e7) s = `${(abs/1e7).toFixed(2)} Cr`;
  else if (abs >= 1e5) s = `${(abs/1e5).toFixed(1)} L`;
  else if (abs >= 1e3) s = `${(abs/1e3).toFixed(1)} K`;
  else s = `${Math.round(abs)}`;
  return `INR ${s}`;
}

/**
 * Generate a professional A4 PDF report.
 * @param {object} data - full report data from /api/report-data
 * @returns {Buffer} - PDF buffer
 */
async function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc    = new PDFDocument({
      size:    'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title:    'MyWealth OS — Financial Report',
        Author:   'MyWealth OS',
        Subject:  'Personal Finance Analysis',
        Creator:  'MyWealth OS v2.1',
      },
    });

    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', err   => reject(err));

    const W = doc.page.width  - doc.page.margins.left - doc.page.margins.right;  // 495
    const L = doc.page.margins.left;

    // ── Helper functions ──────────────────────────────────────────────────────

    function sectionTitle(text) {
      doc.moveDown(0.8)
         .fontSize(11).fillColor(C.primary).font('Helvetica-Bold')
         .text(text.toUpperCase(), L, doc.y, { characterSpacing: 1.2 });
      doc.moveDown(0.15)
         .rect(L, doc.y, W, 1).fill(C.primary)
         .moveDown(0.5);
    }

    function row2(label, value, color = C.dark) {
      const y = doc.y;
      doc.fontSize(9).fillColor(C.mid).font('Helvetica').text(label, L, y, { width: W/2 - 8 });
      doc.fontSize(9).fillColor(color).font('Helvetica-Bold').text(value, L + W/2, y, { width: W/2, align: 'right' });
      doc.moveDown(0.3);
    }

    function bulletList(items, icon = '•') {
      items.forEach(item => {
        doc.fontSize(9).fillColor(C.dark).font('Helvetica')
           .text(`${icon}  ${item}`, L + 12, doc.y, { width: W - 12, lineGap: 2 })
           .moveDown(0.2);
      });
    }

    function numberedList(items) {
      items.forEach((item, i) => {
        doc.fontSize(9).fillColor(C.dark).font('Helvetica')
           .text(`${i+1}.  ${item}`, L + 12, doc.y, { width: W - 12, lineGap: 2 })
           .moveDown(0.25);
      });
    }

    function badge(text, color) {
      const bw = 100, bh = 20;
      const x  = L + W - bw;
      const y  = doc.y;
      doc.roundedRect(x, y, bw, bh, 4).fill(color);
      doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold')
         .text(text, x, y + 5, { width: bw, align: 'center' });
      doc.moveDown(0.3);
    }

    function kpiBox(x, y, w, h, label, value, valueColor) {
      doc.roundedRect(x, y, w, h, 6).fill(C.bgCard);
      doc.rect(x, y, 3, h).fill(valueColor);
      doc.fontSize(7.5).fillColor(C.light).font('Helvetica')
         .text(label.toUpperCase(), x + 10, y + 8, { width: w - 14, characterSpacing: 0.5 });
      doc.fontSize(13).fillColor(valueColor).font('Helvetica-Bold')
         .text(value, x + 10, y + 20, { width: w - 14 });
    }

    // ── HEADER ────────────────────────────────────────────────────────────────
    // Purple banner
    doc.rect(0, 0, doc.page.width, 100).fill(C.primary);

    // App name
    doc.fontSize(22).fillColor(C.white).font('Helvetica-Bold')
       .text('MyWealth OS', L, 22);
    doc.fontSize(10).fillColor('#c4b5fd').font('Helvetica')
       .text('AI Financial Report', L, 48);

    // Date on right
    const genDate = new Date(data.generatedAt || Date.now()).toLocaleDateString('en-IN', {
      day:'2-digit', month:'long', year:'numeric',
    });
    doc.fontSize(8).fillColor('#c4b5fd').font('Helvetica')
       .text(`Generated: ${genDate}`, L, 30, { width: W, align: 'right' });
    doc.fontSize(8).fillColor('#c4b5fd')
       .text('mywealth-os.vercel.app', L, 42, { width: W, align: 'right' });

    doc.y = 115;

    // ── FINANCIAL SCORE ───────────────────────────────────────────────────────
    const score     = data.score || 0;
    const riskLabel = data.riskLevel || 'Unknown';
    const sColor    = scoreColor(score);

    const scoreBoxW = 140, scoreBoxH = 80;
    doc.roundedRect(L, doc.y, scoreBoxW, scoreBoxH, 8).fill(C.bgCard);
    doc.fontSize(42).fillColor(sColor).font('Helvetica-Bold')
       .text(`${score}`, L, doc.y + 8, { width: scoreBoxW, align: 'center' });
    doc.fontSize(8).fillColor(C.mid).font('Helvetica')
       .text('out of 100', L, doc.y + 55, { width: scoreBoxW, align: 'center' });

    const prevY = doc.y;
    doc.y = prevY + 14;
    doc.fontSize(12).fillColor(C.dark).font('Helvetica-Bold')
       .text(`Risk Level: ${riskLabel}`, L + scoreBoxW + 16, prevY + 8);
    doc.fontSize(9).fillColor(C.mid).font('Helvetica')
       .text(data.scoreDescription || '', L + scoreBoxW + 16, prevY + 28, { width: W - scoreBoxW - 20 });

    doc.y = prevY + scoreBoxH + 16;

    // ── KPI GRID (2 x 3) ─────────────────────────────────────────────────────
    const kw  = (W - 10) / 3;
    const kh  = 56;
    const ky  = doc.y;
    const m   = data.metrics || {};

    const kpis = [
      { label: 'Total Assets',      value: inr(m.totalAssets),      color: C.green  },
      { label: 'Total Liabilities', value: inr(m.totalLiabilities), color: C.red    },
      { label: 'Net Worth',         value: inr(m.netWorth),          color: m.netWorth >= 0 ? C.primary : C.red },
      { label: 'Monthly Income',    value: inr(m.monthlyIncome),     color: C.green  },
      { label: 'Monthly Expenses',  value: inr(m.monthlyExpense),    color: C.amber  },
      { label: 'Savings Rate',      value: `${(m.savingsRate||0).toFixed(1)}%`, color: m.savingsRate>=20?C.green:m.savingsRate>=10?C.amber:C.red },
    ];

    kpis.forEach((k, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      kpiBox(L + col*(kw+5), ky + row*(kh+6), kw, kh, k.label, k.value, k.color);
    });

    doc.y = ky + kh * 2 + 18;

    // ── FINANCIAL SUMMARY ─────────────────────────────────────────────────────
    sectionTitle('Financial Summary');
    row2('Emergency Fund Coverage',    `${(m.efMonths||0).toFixed(1)} months`,              m.efMonths>=6?C.green:m.efMonths>=3?C.amber:C.red);
    row2('Debt-to-Income Ratio',       `${(m.dtiRatio||0).toFixed(0)}%`,                    m.dtiRatio<20?C.green:m.dtiRatio<35?C.amber:C.red);
    row2('Total EMI / Month',          inr(m.totalEMI),                                     C.dark);
    row2('Liquid Assets',              inr(m.liquidAssets),                                  C.dark);
    row2('Unrealised Portfolio Gain',  inr(m.unrealisedGain),                               m.unrealisedGain>=0?C.green:C.red);
    row2('Top Asset Class',            m.topAssetClass || '—',                              C.dark);

    // ── AI GUIDANCE ───────────────────────────────────────────────────────────
    sectionTitle('AI Financial Guidance');
    const ai = data.aiGuidance || {};

    if (ai.positives?.length) {
      doc.fontSize(9).fillColor(C.green).font('Helvetica-Bold').text('✓  What\'s Going Well', L).moveDown(0.2);
      bulletList(ai.positives, '✓');
      doc.moveDown(0.3);
    }
    if (ai.negatives?.length) {
      doc.fontSize(9).fillColor(C.red).font('Helvetica-Bold').text('✗  Areas Needing Attention', L).moveDown(0.2);
      bulletList(ai.negatives, '!');
      doc.moveDown(0.3);
    }
    if (ai.suggestions?.length) {
      doc.fontSize(9).fillColor(C.primary).font('Helvetica-Bold').text('→  Suggestions', L).moveDown(0.2);
      bulletList(ai.suggestions, '→');
    }

    // ── TOP RISKS ─────────────────────────────────────────────────────────────
    if (data.topRisks?.length) {
      sectionTitle('Top Identified Risks');
      data.topRisks.forEach((risk, i) => {
        doc.roundedRect(L, doc.y, W, 22, 4).fill('#fff1f2');
        doc.fontSize(9).fillColor(C.red).font('Helvetica-Bold')
           .text(`${i+1}`, L + 8, doc.y + 6, { width: 16 });
        doc.fontSize(9).fillColor(C.dark).font('Helvetica')
           .text(risk, L + 26, doc.y - 10, { width: W - 30 });
        doc.moveDown(0.55);
      });
    }

    // ── ACTION PLAN ───────────────────────────────────────────────────────────
    // Check if we need a new page
    if (doc.y > 580) doc.addPage();

    sectionTitle('Action Plan');

    if (data.next30Days?.length) {
      doc.fontSize(10).fillColor(C.dark).font('Helvetica-Bold').text('Next 30 Days').moveDown(0.2);
      numberedList(data.next30Days);
      doc.moveDown(0.4);
    }
    if (data.next90Days?.length) {
      doc.fontSize(10).fillColor(C.dark).font('Helvetica-Bold').text('Next 90 Days').moveDown(0.2);
      numberedList(data.next90Days);
    }

    // ── GOALS TABLE ───────────────────────────────────────────────────────────
    if (data.goals?.length) {
      if (doc.y > 600) doc.addPage();
      sectionTitle('Goal Progress');

      const cols = { name: 0, target: 160, current: 270, progress: 370, status: 445 };
      const rowH = 20;

      // Header row
      doc.rect(L, doc.y, W, rowH).fill(C.dark);
      doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold');
      [['Goal', cols.name], ['Target', cols.target], ['Current', cols.current],
       ['Progress', cols.progress], ['Status', cols.status]]
        .forEach(([t, x]) => doc.text(t, L + x + 4, doc.y - rowH + 6, { width: 100 }));
      doc.moveDown(0.1);

      data.goals.forEach((g, i) => {
        if (doc.y > 720) doc.addPage();
        const bg = i % 2 === 0 ? C.bgCard : C.white;
        const y  = doc.y;
        doc.rect(L, y, W, rowH).fill(bg);
        const pct = Math.min(100, (+g.current_amount / +g.target_amount) * 100) || 0;
        doc.fontSize(8).fillColor(C.dark).font('Helvetica');
        doc.text(g.goal_name.slice(0,22),  L + 4,          y+6, { width: 150 });
        doc.text(inr(g.target_amount),      L + cols.target+4, y+6, { width: 100 });
        doc.text(inr(g.current_amount),     L + cols.current+4,y+6, { width: 90  });
        doc.text(`${pct.toFixed(0)}%`,      L + cols.progress+4,y+6,{ width: 70  });
        const st = pct >= 100 ? 'Done' : pct >= 50 ? 'On Track' : 'Behind';
        doc.fillColor(pct>=100?C.green:pct>=50?C.amber:C.red)
           .font('Helvetica-Bold')
           .text(st, L + cols.status+4, y+6, { width: 60 });
        doc.moveDown(0.05);
      });
    }

    // ── ASSET ALLOCATION TABLE ────────────────────────────────────────────────
    if (data.assetAllocation?.length) {
      if (doc.y > 600) doc.addPage();
      sectionTitle('Asset Allocation');

      const total = data.assetAllocation.reduce((s, a) => s + +a.value, 0);
      const rowH  = 18;

      doc.rect(L, doc.y, W, rowH).fill(C.dark);
      doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold');
      doc.text('Asset Class', L+4, doc.y - rowH + 5, { width: 200 });
      doc.text('Value',       L+210, doc.y - rowH - 13, { width: 120 });
      doc.text('% of Portfolio', L+340, doc.y - rowH - 13, { width: 100, align:'right' });
      doc.moveDown(0.1);

      data.assetAllocation.forEach((a, i) => {
        if (doc.y > 720) doc.addPage();
        const bg  = i % 2 === 0 ? C.bgCard : C.white;
        const pct = total > 0 ? (+a.value / total * 100) : 0;
        const y   = doc.y;
        doc.rect(L, y, W, rowH).fill(bg);
        doc.fontSize(8).fillColor(C.dark).font('Helvetica')
           .text((a.asset_class||'').replace(/_/g,' '), L+4, y+5, { width:200 });
        doc.text(inr(a.value), L+210, y+5, { width:120 });
        doc.fillColor(pct>50?C.red:pct>30?C.amber:C.green).font('Helvetica-Bold')
           .text(`${pct.toFixed(1)}%`, L+340, y+5, { width:100, align:'right' });
        doc.moveDown(0.02);
      });
    }

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const pageH  = doc.page.height;
    const footerY = pageH - 45;
    doc.rect(0, footerY, doc.page.width, 45).fill('#f8fafc');
    doc.rect(0, footerY, doc.page.width, 1).fill(C.border);
    doc.fontSize(7.5).fillColor(C.light).font('Helvetica')
       .text('MyWealth OS  •  Personal Finance Dashboard  •  mywealth-os.vercel.app', 0, footerY + 10, { align: 'center', width: doc.page.width })
       .text('This report is for personal reference only and does not constitute financial advice.', 0, footerY + 22, { align: 'center', width: doc.page.width });

    doc.end();
  });
}

module.exports = { generatePDF };
