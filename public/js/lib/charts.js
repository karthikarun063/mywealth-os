'use strict';
/* ── Chart.js global defaults ────────────────────────────────── */
Chart.defaults.color            = '#64748b';
Chart.defaults.borderColor      = '#1e293b';
Chart.defaults.font.family      = "system-ui,-apple-system,'Segoe UI',sans-serif";
Chart.defaults.font.size        = 11;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#0f172a';
Chart.defaults.plugins.tooltip.borderColor     = '#334155';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.titleColor      = '#f1f5f9';
Chart.defaults.plugins.tooltip.bodyColor       = '#94a3b8';

const ChartRegistry = {};

function destroyChart(id) {
  if (ChartRegistry[id]) { ChartRegistry[id].destroy(); delete ChartRegistry[id]; }
}

function mkChart(id, config) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  ChartRegistry[id] = new Chart(canvas, config);
  return ChartRegistry[id];
}

/* ── Presets ─────────────────────────────────────────────────── */
const Charts = {
  area(id, labels, datasets, opts = {}) {
    return mkChart(id, {
      type: 'line',
      data: { labels, datasets: datasets.map(d => ({
        tension: 0.4, pointRadius: 0, borderWidth: 2,
        fill: true,
        backgroundColor: d.color + '20',
        borderColor: d.color,
        ...d,
      }))},
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid:{display:false}, ticks:{maxRotation:0} },
          y: { grid:{color:'#1e293b'}, ticks:{callback: v => inr(v)}, ...opts.yScale },
        },
        plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${inr(ctx.raw)}` }}},
        ...opts,
      },
    });
  },

  bar(id, labels, datasets, opts = {}) {
    return mkChart(id, {
      type: 'bar',
      data: { labels, datasets: datasets.map(d => ({
        borderRadius: 4, borderSkipped: false,
        backgroundColor: d.color, ...d,
      }))},
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid:{display:false} },
          y: { grid:{color:'#1e293b'}, ticks:{callback: v => inr(v)} },
        },
        plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${inr(ctx.raw)}` }}},
        ...opts,
      },
    });
  },

  horizontalBar(id, labels, data, colors, opts = {}) {
    return mkChart(id, {
      type: 'bar',
      data: { labels, datasets:[{ data, backgroundColor: colors, borderRadius:4, borderSkipped:false }]},
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid:{color:'#1e293b'}, ticks:{callback: v => inr(v)} },
          y: { grid:{display:false} },
        },
        plugins: { tooltip: { callbacks: { label: ctx => inr(ctx.raw) }}},
        ...opts,
      },
    });
  },

  doughnut(id, labels, data, colors, opts = {}) {
    return mkChart(id, {
      type: 'doughnut',
      data: { labels, datasets:[{ data, backgroundColor: colors, borderColor:'transparent', hoverOffset:6 }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: true, position:'right', labels:{ boxWidth:10, padding:12, font:{size:11} }},
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${inr(ctx.raw)} (${((ctx.raw/ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)` }},
        },
        ...opts,
      },
    });
  },

  groupedBar(id, labels, datasets, opts = {}) {
    return mkChart(id, {
      type: 'bar',
      data: { labels, datasets: datasets.map(d => ({
        borderRadius: 3, backgroundColor: d.color, ...d,
      }))},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels:{ boxWidth:10, padding:12 }},
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${inr(ctx.raw)}` }},
        },
        scales: {
          x: { grid:{display:false} },
          y: { grid:{color:'#1e293b'}, ticks:{callback: v => inr(v)} },
        },
        ...opts,
      },
    });
  },
};
