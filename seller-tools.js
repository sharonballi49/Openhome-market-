'use strict';
(() => {
  const form = document.getElementById('cost-form');
  if (!form) return;
  const result = document.getElementById('cost-result');
  const error = document.getElementById('cost-error');
  const dollars = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', minimumFractionDigits:2});
  function clearResult() { result.hidden = true; error.textContent = ''; }
  form.addEventListener('input', clearResult);
  form.addEventListener('reset', clearResult);
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearResult();
    const fields = ['home', 'rate', 'other', 'direct'].map(name => form.elements.namedItem(name));
    if (fields.some(field => field.value.trim() === '' || !field.checkValidity())) {
      error.textContent = 'Enter valid amounts in all fields. Costs cannot be negative, and the fee must be between 0% and 100%.';
      form.reportValidity();
      return;
    }
    const [home, rate, other, direct] = fields.map(field => Number(field.value));
    if (![home, rate, other, direct].every(Number.isFinite)) return;
    const comparison = Math.round((home * rate / 100 + other) * 100);
    const directCents = Math.round(direct * 100);
    const difference = comparison - directCents;
    document.getElementById('cost-comparison-total').textContent = dollars.format(comparison / 100);
    document.getElementById('cost-direct-total').textContent = dollars.format(directCents / 100);
    document.getElementById('cost-difference').textContent = difference === 0
      ? 'Both options have the same entered cost.'
      : `Your owner-directed estimate is ${dollars.format(Math.abs(difference) / 100)} ${difference > 0 ? 'lower' : 'higher'} for the costs compared.`;
    result.hidden = false;
  });
})();
