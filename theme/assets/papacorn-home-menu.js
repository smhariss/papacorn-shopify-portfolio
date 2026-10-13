if (!customElements.get('papacorn-home-menu')) {
  class PapaCornHomeMenu extends HTMLElement {
    connectedCallback() {
      if (this.menuAbort) return;
      this.menuAbort = new AbortController();
      const signal = this.menuAbort.signal;
      this.trigger = this.querySelector('[data-home-menu-open]');
      this.dialog = this.querySelector('[data-home-menu-dialog]');
      this.closeButton = this.querySelector('[data-home-menu-close]');
      if (!this.trigger || !this.dialog) return;
      this.trigger.hidden = false;
      this.trigger.addEventListener('click', () => {
        if (!this.dialog.open) this.dialog.showModal();
        this.trigger.setAttribute('aria-expanded', 'true');
      }, { signal });
      this.closeButton?.addEventListener('click', () => this.dialog.close(), { signal });
      this.dialog.addEventListener('close', () => {
        this.trigger.setAttribute('aria-expanded', 'false');
        this.trigger.focus({ preventScroll: true });
      }, { signal });
      this.dialog.addEventListener('click', event => {
        if (event.target === this.dialog) {
          const bounds = this.dialog.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.dialog.close();
        } else if (event.target.closest?.('a[href]')) this.dialog.close();
      }, { signal });
    }
    disconnectedCallback() {
      if (this.dialog?.open) this.dialog.close();
      this.menuAbort?.abort();
      this.menuAbort = null;
    }
  }
  customElements.define('papacorn-home-menu', PapaCornHomeMenu);
}
