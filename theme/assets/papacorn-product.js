(() => {
  const initializeGallery = (root) => {
    if (root.dataset.galleryReady === 'true') return;
    const image = root.querySelector('[data-pc-product-image]');
    if (!image) return;
    root.querySelectorAll('[data-pc-product-thumbnail]').forEach((thumbnail) => {
      thumbnail.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const data = thumbnail.dataset;
        if (!data.image) return;
        event.preventDefault();
        image.src = data.image;
        image.alt = data.imageAlt || '';
        if (data.imageSrcset) image.srcset = data.imageSrcset;
        else image.removeAttribute('srcset');
      });
    });
    root.dataset.galleryReady = 'true';
  };
  const initialize = (root) => {
    initializeGallery(root);
    if (root.dataset.variantReady === 'true') return;
    const select = root.querySelector('[data-pc-product-variant]');
    const form = root.querySelector('[data-pc-product-form]');
    const identity = root.querySelector('[data-pc-product-id]');
    const quantity = root.querySelector('[data-pc-product-quantity]');
    const add = root.querySelector('[data-pc-product-add]');
    const refresh = root.querySelector('[data-pc-product-refresh]');
    const optionNote = root.querySelector('[data-pc-product-option-note]');
    if (!select || !form || !identity || !quantity || !add) return;
    const price = root.querySelector('[data-pc-product-price]');
    const image = root.querySelector('[data-pc-product-image]');
    const status = root.querySelector('[data-pc-product-status]');
    const minimumLabel = root.querySelector('[data-pc-product-rule-min]');
    const maximumLabel = root.querySelector('[data-pc-product-rule-max]');
    const stepLabel = root.querySelector('[data-pc-product-rule-step]');
    const update = () => {
      const selected = select.selectedOptions[0];
      if (!selected) return;
      const data = selected.dataset;
      const minimum = Math.max(1, Number(data.min) || 1);
      const step = Math.max(1, Number(data.step) || 1);
      const maximum = data.max === '' || data.max == null ? null : Number(data.max);
      const needsPlan = data.requiresPlan === 'true';
      const maximumReached = maximum !== null && maximum < minimum;
      const available = root.dataset.purchasable === 'true' && data.available === 'true' && !needsPlan && !maximumReached;
      identity.value = selected.value;
      identity.disabled = !available;
      quantity.setAttribute('min', minimum);
      quantity.setAttribute('step', step);
      if (maximum === null) quantity.removeAttribute('max');
      else quantity.setAttribute('max', maximum);
      const previous = Number(quantity.value);
      let next = Number.isFinite(previous) ? Math.max(minimum, previous) : minimum;
      next = minimum + Math.ceil((next - minimum) / step) * step;
      if (maximum !== null && next > maximum) next = minimum + Math.floor((maximum - minimum) / step) * step;
      quantity.value = String(Math.max(minimum, next));
      quantity.disabled = !available;
      add.disabled = !available;
      const unavailableLabel = needsPlan ? root.dataset.purchaseOptionsLabel : maximumReached ? root.dataset.maxReachedLabel : root.dataset.soldOutLabel;
      add.textContent = available ? root.dataset.addLabel + ' +' : unavailableLabel;
      if (price) price.textContent = data.price || '';
      if (status) status.textContent = available ? '' : unavailableLabel;
      if (image && data.image) {
        image.src = data.image;
        image.alt = data.imageAlt || '';
        image.removeAttribute('srcset');
      }
      if (minimumLabel) {
        minimumLabel.textContent = data.minLabel || '';
        minimumLabel.hidden = minimum <= 1;
      }
      if (maximumLabel) {
        maximumLabel.textContent = data.maxLabel || '';
        maximumLabel.hidden = maximum === null;
      }
      if (stepLabel) {
        stepLabel.textContent = data.stepLabel || '';
        stepLabel.hidden = step <= 1;
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', selected.value);
        window.history.replaceState({}, '', url);
      } catch {}
    };
    select.addEventListener('change', update);
    root.dataset.variantReady = 'true';
    if (refresh) refresh.hidden = true;
    if (optionNote) optionNote.hidden = true;
  };
  const boot = () => document.querySelectorAll('[data-pc-product]').forEach(initialize);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  document.addEventListener('shopify:section:load', boot);
})();
