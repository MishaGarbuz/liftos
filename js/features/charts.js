/**
 * @file Shared Chart.js helpers used by the progress and dashboard pages.
 *
 * These functions are intentionally framework-agnostic and depend only on
 * Chart.js (loaded globally) and the theme color helpers (`getChartUiColors`).
 * They are attached to the global scope so any page script can consume them
 * regardless of load order, as long as this module loads first.
 */
(function (global) {
  /**
   * Compute padded y-axis bounds for weight/rep line charts so the series
   * doesn't sit flush against the chart edges.
   * @param {Array<{data: Array<number|null>}>} datasets
   * @returns {{suggestedMin?: number, suggestedMax?: number}}
   */
  function getWeightChartScaleBounds(datasets) {
    const vals = datasets
      .flatMap((ds) => ds.data || [])
      .filter((v) => v != null && v !== '' && !Number.isNaN(Number(v)))
      .map(Number);
    if (!vals.length) return {};
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 10;
    const pad = Math.max(4, span * 0.12);
    return {
      suggestedMin: Math.max(0, Math.floor(min - pad)),
      suggestedMax: Math.ceil(max + pad * 0.35),
    };
  }

  /** Nudge a chart to resize across a few frames (handles late layout shifts). */
  function scheduleChartResize(chart) {
    if (!chart) return;
    const resize = () => {
      try { chart.resize(); } catch (_) { /* chart destroyed */ }
    };
    requestAnimationFrame(() => requestAnimationFrame(resize));
    setTimeout(resize, 120);
    setTimeout(resize, 400);
  }

  /** Keep a chart sized to its container via ResizeObserver (with fallbacks). */
  function observeChartContainer(chart, container) {
    if (!chart || !container) { scheduleChartResize(chart); return; }
    if (container._chartResizeObserver) container._chartResizeObserver.disconnect();
    if (typeof ResizeObserver === 'undefined') { scheduleChartResize(chart); return; }
    const ro = new ResizeObserver(() => requestAnimationFrame(() => chart.resize()));
    ro.observe(container);
    container._chartResizeObserver = ro;
    scheduleChartResize(chart);
  }

  /**
   * Build a themed Chart.js options object for line charts.
   * @param {string} unit - appended to y-axis tick labels (e.g. "kg", " reps")
   * @param {object} [yScale] - extra y-scale overrides (e.g. suggestedMin/Max)
   */
  function chartOptions(unit, yScale = {}) {
    const iosPwa = document.documentElement.classList.contains('ios-pwa');
    const ui = typeof getChartUiColors === 'function'
      ? getChartUiColors()
      : { tick: '#8892a4', grid: 'rgba(255,255,255,0.05)', tooltipBg: '#1a2235', tooltipTitle: '#e8eaf0', tooltipBody: '#8892a4' };
    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 6, right: 10, bottom: iosPwa ? 26 : 14, left: 8 } },
      plugins: {
        legend: { labels: { color: ui.tick, font: { size: 11 }, boxHeight: 10 } },
        tooltip: {
          backgroundColor: ui.tooltipBg,
          borderColor: ui.grid,
          borderWidth: 1,
          titleColor: ui.tooltipTitle,
          bodyColor: ui.tooltipBody,
          padding: 10,
        },
      },
      scales: {
        x: { ticks: { color: ui.tick, font: { size: 11 } }, grid: { color: ui.grid } },
        y: {
          ticks: { color: ui.tick, font: { size: 11 }, callback: (v) => v + unit },
          grid: { color: ui.grid },
          grace: '8%',
          ...yScale,
        },
      },
    };
  }

  global.getWeightChartScaleBounds = getWeightChartScaleBounds;
  global.scheduleChartResize = scheduleChartResize;
  global.observeChartContainer = observeChartContainer;
  global.chartOptions = chartOptions;
})(typeof window !== 'undefined' ? window : globalThis);
