import { round } from './model.js';

export function incrementValue(value, direction, min, max) {
  return round(Math.min(max, Math.max(min, value + direction)));
}

// Native step="1" rejects decimals; step="any" plus explicit controls allows both.
export function setupNumberInputs() {
  document.querySelectorAll('input[type="number"]').forEach(input => {
    const wrapper = document.createElement('span');
    wrapper.className = 'number-control' + (input.id === 'tax' ? ' number-control-tax' : '');
    input.before(wrapper);
    wrapper.append(input);
    const change = direction => {
      const min = input.min === '' ? -Infinity : Number(input.min);
      const max = input.max === '' ? Infinity : Number(input.max);
      input.value = incrementValue(Number(input.value) || 0, direction, min, max);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const controls = document.createElement('span');
    controls.className = 'number-buttons';
    for (const direction of [1, -1]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = direction > 0 ? '+' : '−';
      button.setAttribute('aria-label', `${direction > 0 ? 'Aumentar' : 'Reducir'} ${input.id === 'tax' ? '1 punto porcentual' : '1 euro'}`);
      button.setAttribute('aria-controls', input.id);
      button.addEventListener('click', () => change(direction));
      controls.append(button);
    }
    wrapper.append(controls);
    input.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      change(event.key === 'ArrowUp' ? 1 : -1);
    });
  });
}
