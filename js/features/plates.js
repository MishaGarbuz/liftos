/**
 * @file Plate calculator — target weight → bar + plates per side.
 */
(function (global) {
  const METRIC_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
  const LB_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];
  const DEFAULT_BAR_KG = 20;
  const DEFAULT_BAR_LB = 45;

  /**
   * Greedy plate loading per side (largest plates first).
   * @param {number} targetTotal — desired total on the bar
   * @param {'kg'|'lb'} unit
   * @param {number} barWeight — empty bar weight
   */
  function calculatePlates(targetTotal, unit, barWeight) {
    const plates = unit === 'lb' ? LB_PLATES : METRIC_PLATES;
    const bar = Number.isFinite(barWeight) ? barWeight : unit === 'lb' ? DEFAULT_BAR_LB : DEFAULT_BAR_KG;
    const target = Number(targetTotal);
    if (!Number.isFinite(target) || target <= 0) {
      return { error: 'Enter a valid target weight.', bar, perSide: [], sideTotal: 0, achieved: bar };
    }
    if (target < bar) {
      return {
        error: `Target is below the ${bar}${unit} bar.`,
        bar,
        perSide: [],
        sideTotal: 0,
        achieved: bar,
        remainder: target - bar,
      };
    }

    let remaining = Math.round(((target - bar) / 2) * 100) / 100;
    const perSide = [];
    for (const plate of plates) {
      while (remaining >= plate - 0.001) {
        perSide.push(plate);
        remaining = Math.round((remaining - plate) * 100) / 100;
      }
    }

    const sideTotal = Math.round(perSide.reduce((sum, p) => sum + p, 0) * 100) / 100;
    const achieved = Math.round((bar + sideTotal * 2) * 100) / 100;
    const remainder = Math.round((target - achieved) * 100) / 100;

    return { bar, perSide, sideTotal, achieved, remainder, error: null };
  }

  function formatPlateList(perSide, unit) {
    if (!perSide.length) return '—';
    const counts = {};
    perSide.forEach((p) => {
      const key = String(p);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([w, n]) => (n > 1 ? `${n}×${w}` : w) + unit)
      .join(' + ');
  }

  function renderResult(result, unit) {
    const body = document.getElementById('plateCalcBody');
    if (!body) return;

    if (result.error && !result.perSide.length) {
      body.innerHTML = `<p class="plate-calc-error">${result.error}</p>`;
      return;
    }

    const perSideLabel = formatPlateList(result.perSide, unit);
    const warn =
      Math.abs(result.remainder) > 0.01
        ? `<p class="plate-calc-warn">Closest load: <strong>${result.achieved}${unit}</strong> (${result.remainder > 0 ? '+' : ''}${result.remainder}${unit} vs target)</p>`
        : `<p class="plate-calc-ok">Exact match: <strong>${result.achieved}${unit}</strong></p>`;

    body.innerHTML = `
      <div class="plate-calc-visual">
        <div class="plate-calc-side">
          <span class="plate-calc-side-label">Per side</span>
          <span class="plate-calc-side-value">${result.sideTotal}${unit}</span>
          <span class="plate-calc-side-detail">${perSideLabel}</span>
        </div>
        <div class="plate-calc-bar">
          <span class="plate-calc-bar-label">Bar</span>
          <span class="plate-calc-bar-value">${result.bar}${unit}</span>
        </div>
        <div class="plate-calc-side">
          <span class="plate-calc-side-label">Per side</span>
          <span class="plate-calc-side-value">${result.sideTotal}${unit}</span>
          <span class="plate-calc-side-detail">${perSideLabel}</span>
        </div>
      </div>
      ${warn}
      <p class="plate-calc-formula">${result.bar}${unit} bar + (${result.sideTotal}${unit} × 2) = ${result.achieved}${unit}</p>`;
  }

  function getUnit() {
    return typeof state !== 'undefined' && state.prefs?.units === 'lb' ? 'lb' : 'kg';
  }

  function renderEmptyState() {
    const body = document.getElementById('plateCalcBody');
    if (!body) return;
    body.innerHTML =
      '<p class="plate-calc-hint">Enter a target total to see plates per side.</p>';
  }

  function runCalculation() {
    const unit = getUnit();
    const targetInput = document.getElementById('plateCalcTarget');
    const targetRaw = targetInput?.value ?? '';
    const target = parseFloat(targetRaw);
    const bar = parseFloat(document.getElementById('plateCalcBar')?.value);
    if (targetRaw.trim() === '' || !Number.isFinite(target)) {
      renderEmptyState();
      return;
    }
    renderResult(calculatePlates(target, unit, bar), unit);
  }

  function scrollPlateFieldIntoView(input) {
    if (!input) return;
    requestAnimationFrame(() => {
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function bindPlateCalcInputs() {
    const modal = document.getElementById('plateCalcModal');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';
    modal.querySelectorAll('input').forEach((input) => {
      input.addEventListener('focus', () => scrollPlateFieldIntoView(input));
    });
  }

  function openPlateCalculator(prefillWeight) {
    const modal = document.getElementById('plateCalcModal');
    if (!modal) return;
    bindPlateCalcInputs();
    const unit = getUnit();
    const barInput = document.getElementById('plateCalcBar');
    const targetInput = document.getElementById('plateCalcTarget');
    const unitLbl = document.getElementById('plateCalcUnitLabel');
    if (barInput) barInput.value = unit === 'lb' ? DEFAULT_BAR_LB : DEFAULT_BAR_KG;
    if (targetInput) {
      targetInput.value =
        prefillWeight != null && prefillWeight !== ''
          ? String(prefillWeight)
          : '';
    }
    if (unitLbl) unitLbl.textContent = unit;
    modal.classList.add('open');
    if (targetInput?.value) runCalculation();
    else renderEmptyState();
  }

  function closePlateCalculator() {
    const modal = document.getElementById('plateCalcModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.getElementById('plateCalcTarget')?.blur();
    document.getElementById('plateCalcBar')?.blur();
  }

  global.openPlateCalculator = openPlateCalculator;
  global.closePlateCalculator = closePlateCalculator;
  global.runPlateCalculation = runCalculation;
})(window);
