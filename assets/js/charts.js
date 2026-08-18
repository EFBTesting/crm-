/* ==========================================================================
   Thin wrapper around Chart.js so views can re-render without leaking
   canvas instances (Chart.js throws if you re-init a canvas in place).
   ========================================================================== */

const Charts = (() => {
  const instances = {};

  function render(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    if (instances[canvasId]) {
      instances[canvasId].destroy();
      delete instances[canvasId];
    }
    if (typeof Chart === 'undefined') {
      // Chart.js failed to load (e.g. offline) — show a graceful message instead of crashing.
      const wrap = canvas.closest('.chart-box');
      if (wrap) wrap.innerHTML = '<p class="empty-inline">Charts library did not load (no internet connection?). KPI numbers above are still accurate.</p>';
      return null;
    }
    instances[canvasId] = new Chart(canvas, config);
    return instances[canvasId];
  }

  function destroyAll() {
    Object.keys(instances).forEach(k => {
      instances[k].destroy();
      delete instances[k];
    });
  }

  return { render, destroyAll };
})();

const PALETTE = {
  ink: '#1f2933',
  amber: '#e07a2c',
  amberSoft: 'rgba(224, 122, 44, 0.16)',
  navy: '#2b3a55',
  navySoft: 'rgba(43, 58, 85, 0.14)',
  green: '#3f8f5f',
  greenSoft: 'rgba(63, 143, 95, 0.16)',
  red: '#c1493b',
  redSoft: 'rgba(193, 73, 59, 0.16)',
  slate: '#6b7686',
  grid: 'rgba(120, 130, 145, 0.16)',
  stageColors: ['#8a97ab', '#4f7cac', '#e0a12c', '#e07a2c', '#3f8f5f'],
};
