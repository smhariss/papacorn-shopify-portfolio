function wholeQuantity(value) {
  const raw = String(value);
  if (!/^\d+$/.test(raw)) return null;
  const quantity = Number(raw);
  return Number.isSafeInteger(quantity) ? quantity : null;
}

function quantityRule(row) {
  return {
    min: Math.max(1, Number(row.min) || 1),
    increment: Math.max(1, Number(row.increment) || 1),
    max: row.max !== null && row.max !== undefined && row.max !== '' ? Number(row.max) : null
  };
}

export function evaluateSelection(rows, existingOfferQuantity = 0) {
  const state = { count: 0, subtotal: 0, selected: [], issues: [], hasPreview: false, canSubmit: false };
  rows.forEach((row, index) => {
    const quantity = wholeQuantity(row.quantity);
    if (quantity === null) {
      state.issues.push({ index, code: 'invalid_quantity' });
      return;
    }
    if (quantity === 0) return;
    state.count += quantity;
    state.subtotal += quantity * Number(row.price);
    state.hasPreview ||= Boolean(row.previewPrice);
    state.selected.push({ ...row, quantity });
    const rule = quantityRule(row);
    if (quantity < rule.min || (quantity - rule.min) % rule.increment !== 0 || (rule.max !== null && quantity > rule.max)) {
      state.issues.push({ index, code: 'quantity_rule' });
    }
    if (!row.available || !/^\d+$/.test(String(row.id || ''))) {
      state.issues.push({ index, code: 'unavailable' });
    }
  });
  state.canSubmit = state.count > 0 && state.issues.length === 0 && Number.isSafeInteger(state.subtotal);
  state.existingOfferQuantity = wholeQuantity(existingOfferQuantity) ?? 0;
  const offerQuantity = state.count + state.existingOfferQuantity;
  state.offerEligible = offerQuantity >= 5;
  state.bagsRemaining = Math.max(0, 5 - offerQuantity);
  state.savings = state.offerEligible ? Math.round(state.subtotal * 0.2) : 0;
  state.estimatedTotal = state.subtotal - state.savings;
  return state;
}

export function stepQuantity(value, direction, row) {
  const quantity = wholeQuantity(value) ?? 0;
  const rule = quantityRule(row);
  if (direction < 0) return quantity <= rule.min ? 0 : Math.max(rule.min, quantity - rule.increment);
  const next = quantity === 0 ? rule.min : quantity + rule.increment;
  if (rule.max === null) return next;
  if (rule.max < rule.min) return 0;
  const highest = rule.min + Math.floor((rule.max - rule.min) / rule.increment) * rule.increment;
  return Math.min(next, highest);
}

export function buildCartPayload(state) {
  if (!state.canSubmit) throw new RangeError('Select valid available flavours before adding to the cart.');
  return { items: state.selected.map(row => ({ id: String(row.id), quantity: row.quantity })) };
}

export class BundleCartController {
  constructor(options) {
    this.options = options;
    this.busy = false;
    this.locked = false;
  }

  async submit() {
    if (this.busy || this.locked) return false;
    const state = evaluateSelection(this.options.getRows(), this.options.existingOfferQuantity);
    const onError = this.options.onError || (() => {});
    if (!state.canSubmit) {
      onError(state.issues[0]?.code || 'empty_error');
      return false;
    }
    onError('');
    this.busy = true;
    this.options.onBusy?.(true);
    try {
      const response = await this.options.fetch(`${this.options.addUrl.replace(/\.js$/, '')}.js`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(buildCartPayload(state))
      });
      if (!response.ok) {
        // An unsuccessful multi-item response can still have added some bags.
        this.locked = true;
        onError(response.status === 422 ? 'inventory_error' : 'cart_error');
        this.busy = false;
        this.options.onBusy?.(false);
        return false;
      }
      const result = await response.json();
      if (!Array.isArray(result.items) || result.items.length === 0) throw new TypeError('Unconfirmed cart response');
      this.options.navigate(this.options.cartUrl);
      return true;
    } catch {
      // Losing the response does not prove that Shopify rejected the add.
      this.locked = true;
      onError('network_error');
      this.busy = false;
      this.options.onBusy?.(false);
      return false;
    }
  }
}

export function enhanceBundle(root, dependencies = {}) {
  if (root.dataset.bundleReady === 'true') return null;
  const cards = Array.from(root.querySelectorAll('[data-bundle-card]'));
  const submit = root.querySelector('[data-bundle-submit]');
  const form = root.querySelector('[data-bundle-form]');
  const error = root.querySelector('[data-bundle-error]');
  const status = root.querySelector('[data-bundle-status]');
  const messages = JSON.parse(root.querySelector('[data-bundle-messages]').textContent);
  const existingOfferQuantity = wholeQuantity(root.dataset.existingOfferQuantity) ?? 0;
  const money = new Intl.NumberFormat(root.dataset.locale || 'en', {
    style: 'currency', currency: root.dataset.currency || 'PKR', maximumFractionDigits: 2
  });
  const formatMoney = cents => money.format(cents / 100);
  const getRows = () => cards.map(card => ({
    id: card.dataset.variantId,
    title: card.dataset.title,
    quantity: card.querySelector('[data-bundle-quantity]').value,
    price: Number(card.dataset.price),
    available: card.dataset.available === 'true',
    previewPrice: card.dataset.previewPrice === 'true',
    min: Number(card.dataset.min), increment: Number(card.dataset.increment), max: card.dataset.max,
    image: card.querySelector('[data-bundle-art]')?.getAttribute('src') || '',
    ink: card.style.getPropertyValue('--pc-bundle-ink'), background: card.style.getPropertyValue('--pc-bundle-card')
  }));
  let busy = false;
  let submissionError = '';
  function render() {
    const rows = getRows();
    const state = evaluateSelection(rows, existingOfferQuantity);
    root.dataset.selectionCount = String(state.count);
    root.querySelector('[data-bundle-count]').textContent = String(state.count);
    root.querySelector('[data-bundle-subtotal]').textContent = formatMoney(state.subtotal);
    root.querySelector('[data-bundle-subtotal-label]').textContent = state.hasPreview ? messages.preview_subtotal : messages.subtotal;
    root.querySelector('[data-bundle-offer-progress]').textContent = state.offerEligible
      ? state.hasPreview ? messages.offer_preview_unlocked : messages.offer_unlocked
      : (state.bagsRemaining === 1 ? messages.offer_remaining_one : messages.offer_remaining).replace('[quantity]', String(state.bagsRemaining)).replace('{{ quantity }}', String(state.bagsRemaining));
    root.querySelector('[data-bundle-savings-row]').hidden = !state.offerEligible || state.count === 0;
    root.querySelector('[data-bundle-savings]').textContent = `−${formatMoney(state.savings)}`;
    root.querySelector('[data-bundle-total-row]').hidden = !state.offerEligible || state.count === 0;
    root.querySelector('[data-bundle-total]').textContent = formatMoney(state.estimatedTotal);
    root.querySelector('[data-bundle-total-label]').textContent = state.hasPreview ? messages.preview_total : messages.estimated_total;
    root.querySelector('[data-bundle-offer-note]').textContent = (state.hasPreview ? messages.offer_preview_note : messages.offer_note)
      + (existingOfferQuantity > 0 ? ` ${messages.offer_cart_bags.replace('[quantity]', String(existingOfferQuantity)).replace('{{ quantity }}', String(existingOfferQuantity))}` : '');
    const selection = root.querySelector('[data-bundle-selection]');
    selection.replaceChildren();
    state.selected.forEach(row => {
      const mini = root.ownerDocument.createElement('li');
      mini.className = 'pc-bundle-mini';
      mini.style.setProperty('--pc-bundle-mini-bg', row.background);
      mini.style.setProperty('--pc-bundle-mini-ink', row.ink);
      if (row.image) {
        const image = root.ownerDocument.createElement('img');
        image.src = row.image;
        image.alt = '';
        image.width = 44;
        image.height = 58;
        mini.append(image);
      }
      const label = root.ownerDocument.createElement('span');
      label.textContent = `${row.quantity} × ${row.title}`;
      mini.append(label);
      selection.append(mini);
    });
    root.querySelector('[data-bundle-empty]').hidden = state.count > 0;
    cards.forEach((card, index) => {
      const input = card.querySelector('[data-bundle-quantity]');
      const invalid = state.issues.some(issue => issue.index === index && issue.code !== 'unavailable');
      input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      input.disabled = busy;
      const quantityIssue = state.issues.find(issue => issue.index === index && issue.code !== 'unavailable');
      input.setCustomValidity(quantityIssue ? messages[quantityIssue.code] : '');
      card.dataset.selected = wholeQuantity(rows[index].quantity) > 0 ? 'true' : 'false';
      const current = wholeQuantity(rows[index].quantity) ?? 0;
      card.querySelector('[data-bundle-minus]').disabled = busy || current === 0;
      card.querySelector('[data-bundle-plus]').disabled = busy || stepQuantity(input.value, 1, rows[index]) <= current;
      card.querySelector('[data-bundle-line-total]').textContent = formatMoney(current * rows[index].price);
      card.querySelector('[data-bundle-input-error]').hidden = !invalid;
    });
    submit.disabled = busy || controller.locked || !state.canSubmit;
    submit.textContent = busy ? messages.adding : messages.add_to_cart;
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (!busy) {
      const issue = state.issues[0];
      status.textContent = controller.locked ? messages[submissionError] : issue ? messages[issue.code] : state.count === 0 ? messages.pick_flavours : messages.ready;
    }
    return state;
  }
  const controller = new BundleCartController({
    getRows, existingOfferQuantity, addUrl: form.getAttribute('action'), cartUrl: root.dataset.cartUrl,
    fetch: dependencies.fetch || window.fetch.bind(window),
    navigate: dependencies.navigate || (url => window.location.assign(url)),
    onBusy(value) { busy = value; render(); },
    onError(code) {
      submissionError = code;
      error.textContent = messages[code] || '';
      error.hidden = !code;
      if (code) error.focus();
    }
  });
  cards.forEach(card => {
    const input = card.querySelector('[data-bundle-quantity]');
    card.querySelectorAll('[data-bundle-step]').forEach(button => button.addEventListener('click', () => {
      input.value = String(stepQuantity(input.value, Number(button.dataset.bundleStep), {
        min: card.dataset.min, increment: card.dataset.increment, max: card.dataset.max
      }));
      if (!controller.locked) error.hidden = true;
      render();
    }));
    input.addEventListener('input', () => { if (!controller.locked) error.hidden = true; render(); });
    input.addEventListener('change', () => { if (input.value === '') input.value = '0'; render(); });
  });
  root.querySelector('[data-bundle-clear]').addEventListener('click', () => {
    if (busy) return;
    cards.forEach(card => { card.querySelector('[data-bundle-quantity]').value = '0'; });
    if (!controller.locked) error.hidden = true;
    render();
  });
  form.addEventListener('submit', event => { event.preventDefault(); controller.submit(); });
  root.dataset.bundleReady = 'true';
  root.classList.add('pc-bundle--enhanced');
  root.querySelectorAll('[data-bundle-quantity]').forEach(input => { input.disabled = false; });
  root.querySelector('[data-bundle-clear]').hidden = false;
  submit.hidden = false;
  render();
  return controller;
}

if (typeof document !== 'undefined') {
  const initialize = scope => scope.querySelectorAll('[data-papacorn-bundle]').forEach(root => enhanceBundle(root));
  initialize(document);
  document.addEventListener('shopify:section:load', event => initialize(event.target));
}
