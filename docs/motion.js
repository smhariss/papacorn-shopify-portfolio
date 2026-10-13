import {sceneProgress,wrapFlavor} from './motion-state.js';
if (!customElements.get('papacorn-homepage')) {
  class PapaCornHomepage extends HTMLElement {
    static clamp(value) { return Math.max(0, Math.min(1, value)); }
    static smooth(value) { const t = this.clamp(value); return t * t * (3 - 2 * t); }
    static mix(a, b, amount) { return a + (b - a) * amount; }
    static easePointer(current, target, elapsed) {
      const amount = 1 - Math.exp(-Math.max(0, Math.min(64, elapsed)) / 120);
      return { x: this.mix(current.x, target.x, amount), y: this.mix(current.y, target.y, amount) };
    }
    static composePacketPose(base, { index, progress, width, height, pointerX, pointerY, time, enabled }) {
      const pose = { ...base };
      if (!enabled) return pose;
      const strength = (1 - this.smooth((progress - .56) / .10)) * base.opacity;
      const x = Number.isFinite(pointerX) ? Math.max(-1, Math.min(1, pointerX)) : 0;
      const y = Number.isFinite(pointerY) ? Math.max(-1, Math.min(1, pointerY)) : 0;
      const depth = .55 + Math.min(12, Math.max(0, base.z)) / 24;
      const phase = time / 1200 + index * 1.3;
      pose.x += (x * Math.min(width * .045, 60) * depth + Math.cos(phase * .7) * 2) * strength;
      pose.y += (y * Math.min(height * .04, 36) * depth + Math.sin(phase) * 6) * strength;
      pose.rotation += (x * 3 * depth + Math.sin(phase * .8) * .8) * strength;
      return pose;
    }
    static arcMotion({ top, height, viewport, stageHeight = viewport, trackWidth, stageWidth, inset }) {
      const entry = this.smooth((viewport - top) / Math.max(1, viewport));
      const travel = Math.max(1, height - stageHeight);
      const progress = this.clamp(-top / travel);
      const extent = Math.max(0, trackWidth - stageWidth + 2 * inset);
      return { entry, progress, reveal: this.clamp(progress / .65), x: inset - extent * progress, cardProgress: progress, extent };
    }
    static openingPose({ index, selected, order, progress, width, height, heroIndices }) {
      const mobile = width < 750;
      const count = order.length;
      const selectedPosition = order.indexOf(selected);
      const heroLeft = order[(selectedPosition - 1 + count) % count];
      const heroRight = order[(selectedPosition + 1) % count];
      let rank = (order.indexOf(index) - selectedPosition + count) % count;
      if (rank > count / 2) rank -= count;
      const rowAmount = this.smooth((progress - .08) / .30);
      const detailAmount = this.smooth((progress - .58) / .22);
      const direction = rank < 0 ? -1 : 1;
      const absRank = Math.abs(rank);
      const hero = { x: direction < 0 ? -(1 + absRank * .22) * width : (2 + absRank * .22) * width, y: height * .65, size: width * .5, rotation: direction * 30, opacity: 0, z: 1 };
      if (index === heroLeft) Object.assign(hero, { x: width * (mobile ? -.12 : -.06), y: height * (mobile ? .75 : .80), size: width * (mobile ? .55 : .50), rotation: -24, opacity: 1, z: 7 });
      if (index === heroRight) Object.assign(hero, { x: width * (mobile ? 1.10 : 1.03), y: height * (mobile ? .75 : .55), size: width * (mobile ? .55 : .50), rotation: 24, opacity: 1, z: 7 });
      if (index === selected) Object.assign(hero, { x: width * .5, y: mobile ? height * .695 : -Math.max(height * .13, width * .275 - height * .34), size: width * (mobile ? .60 : .50), rotation: mobile ? 0 : 17, opacity: 1, z: 12 });
      const rowSize = mobile ? [.82, .60, .45, .35, .30][Math.min(absRank, 4)] * width : Math.min([.35, .26, .205, .18, .16][Math.min(absRank, 4)] * width, height * .73);
      const row = { x: width * (.5 + rank * (mobile ? .43 : .21)), y: height * (.54 + absRank * .025), size: rowSize, rotation: rank * (mobile ? 8 : 7), opacity: absRank <= 2 ? 1 : 0, z: 12 - absRank * 2 };
      const detail = index === selected ? { x: width * (mobile ? .5 : .75), y: height * (mobile ? .285 : .47), size: mobile ? width * .76 : Math.min(width * .50, height * .80), rotation: mobile ? -3 : 5, opacity: 1, z: 12 } : { ...row, x: row.x + direction * width * .85, y: row.y + height * .12, rotation: row.rotation + direction * 20, opacity: 0, z: row.z };
      const result = {};
      ['x', 'y', 'size', 'rotation', 'opacity'].forEach((key) => { result[key] = this.mix(this.mix(hero[key], row[key], rowAmount), detail[key], detailAmount); });
      result.z = progress < .2 ? hero.z : row.z;
      return result;
    }
    connectedCallback() { this.setupFrame = requestAnimationFrame(() => this.initialize()); }
    disconnectedCallback() {
      cancelAnimationFrame(this.setupFrame);
      cancelAnimationFrame(this.frame);
      this.abort?.abort();
      this.observer?.disconnect();
      this.resizeObserver?.disconnect();
      this.packetLayer?.remove();
      this.classList.remove('has-continuity', 'is-past-hero');
      this.packetLayer = null;
      this.lastPacketPoses = null;
      this.composedPacketPoses = null;
      this.selectionFrom = null;
      this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.pointerActive = false;
      this.lastPointerFrame = null;
      this.initialized = false;
      this.frame = 0;
    }
    findScrollRoot() {
      const doc = this.ownerDocument;
      const view = doc.defaultView || window;
      for (let ancestor = this.parentElement; ancestor && ancestor !== doc.body && ancestor !== doc.documentElement; ancestor = ancestor.parentElement) {
        const overflow = view.getComputedStyle(ancestor).overflowY;
        if (/(auto|scroll|overlay)/.test(overflow) && ancestor.scrollHeight > ancestor.clientHeight + 1) return ancestor;
      }
      return null;
    }
    scrollContext() {
      const view = this.ownerDocument.defaultView || window;
      const root = this.scrollRoot;
      return {
        view,
        root,
        top: root ? root.getBoundingClientRect().top + (root.clientTop || 0) : 0,
        height: root ? root.clientHeight : view.innerHeight,
        width: root ? root.clientWidth : view.innerWidth,
        y: root ? root.scrollTop : view.scrollY,
      };
    }
    refreshScrollRoot() {
      this.scrollRoot = this.findScrollRoot();
      const context = this.scrollContext();
      this.style.setProperty('--pc-viewport-height', context.height + 'px');
      this.style.setProperty('--pc-vh', context.height / 100 + 'px');
    }
    initialize() {
      if (this.initialized) return;
      this.initialized = true;
      this.abort = new AbortController();
      const signal = this.abort.signal;
      this.refreshScrollRoot();
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      this.pointerFine = matchMedia('(hover: hover) and (pointer: fine)');
      this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.pointerActive = false;
      this.lastPointerFrame = null;
      this.sequence = this.querySelector('[data-pc-sequence]');
      this.stage = this.querySelector('[data-pc-selector-stage]');
      this.panels = [...this.querySelectorAll('[data-pc-panel]')];
      this.tabs = [...this.querySelectorAll('[data-pc-tab]')];
      this.tablist = this.querySelector('[data-pc-tabs]');
      this.previous = this.querySelector('[data-pc-previous]');
      this.next = this.querySelector('[data-pc-next]');
      this.status = this.querySelector('[data-pc-selected-status]');
      this.story = this.querySelector('[data-pc-story]');
      this.storyCards = [...this.querySelectorAll('[data-pc-story-card]')];
      this.arc = this.querySelector('.pc-m-arc');
      this.arcSticky = this.arc?.querySelector('.pc-m-arc-sticky');
      this.arcTrack = this.arc?.querySelector('.pc-m-arc-cards');
      this.hero = this.querySelector('.pc-m-hero');
      this.final = this.querySelector('.pc-m-final');
      this.opening = this.querySelector('[data-pc-opening]');
      this.openingSticky = this.opening?.querySelector('.pc-m-opening-sticky');
      this.intro = this.querySelector('.pc-m-intro');
      this.rowPrevious = this.querySelector('[data-pc-row-previous]');
      this.rowNext = this.querySelector('[data-pc-row-next]');
      this.rowLabel = this.querySelector('[data-pc-row-label]');
      this.createPacketLayer();
      const headline = this.querySelector('[data-pc-word-reveal]');
      if (headline && !headline.querySelector('.pc-m-word')) {
        const words = headline.textContent.trim().split(/\s+/);
        headline.textContent = '';
        words.forEach((word, index) => {
          const span = document.createElement('span');
          span.className = 'pc-m-word';
          span.textContent = word;
          headline.append(span);
          if (index < words.length - 1) headline.append(document.createTextNode(' '));
        });
      }
      this.words = [...this.querySelectorAll('.pc-m-word')];
      this.classList.add('is-enhanced');
      this.selectedIndex = 0;
      this.tablist?.setAttribute('role', 'tablist');
      this.tabs.forEach((tab, index) => {
        const panel = this.panels[index];
        if (!panel) return;
        tab.id = panel.id + '-tab';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        tab.addEventListener('click', (event) => { event.preventDefault(); this.select(index, true); }, { signal });
        tab.addEventListener('keydown', (event) => {
          let target = index;
          if (event.key === 'ArrowRight') target = (index + 1) % this.tabs.length;
          else if (event.key === 'ArrowLeft') target = (index - 1 + this.tabs.length) % this.tabs.length;
          else if (event.key === 'Home') target = 0;
          else if (event.key === 'End') target = this.tabs.length - 1;
          else return;
          event.preventDefault();
          this.select(target, true);
          this.tabs[target].focus();
        }, { signal });
      });
      this.querySelector('[data-pc-arrows]')?.removeAttribute('hidden');
      this.previous?.addEventListener('click', () => this.step(-1), { signal });
      this.next?.addEventListener('click', () => this.step(1), { signal });
      this.rowPrevious?.addEventListener('click', () => this.step(-1), { signal });
      this.rowNext?.addEventListener('click', () => this.step(1), { signal });
      const swipeSurface = this.continuity ? this.openingSticky : this.stage;
      swipeSurface?.addEventListener('touchstart', (event) => {
        this.swipeStart = null;
        if (this.continuity && this.motion && this.openingProgress < .28) return;
        if (event.touches.length !== 1 || event.target.closest('button,a,input,select,textarea')) return;
        this.swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }, { passive: true, signal });
      swipeSurface?.addEventListener('touchend', (event) => {
        if (!this.swipeStart || !event.changedTouches.length) return;
        const dx = event.changedTouches[0].clientX - this.swipeStart.x;
        const dy = event.changedTouches[0].clientY - this.swipeStart.y;
        this.swipeStart = null;
        if (Math.abs(dx) > 65 && Math.abs(dy) < 55 && Math.abs(dx) > Math.abs(dy) * 1.25) this.step(dx < 0 ? 1 : -1);
      }, { passive: true, signal });
      swipeSurface?.addEventListener('touchcancel', () => { this.swipeStart = null; }, { passive: true, signal });
      this.pointerSurface = this.continuity ? this.openingSticky : this.hero;
      this.pointerSurface?.addEventListener('pointermove', (event) => this.setPointerTarget(event), { passive: true, signal });
      this.pointerSurface?.addEventListener('pointerleave', () => this.resetPointer(), { signal });
      this.pointerSurface?.addEventListener('pointercancel', () => this.resetPointer(), { signal });
      this.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (!this.motion || !this.sequence || !link || link.getAttribute('href') !== '#' + this.sequence.id) return;
        event.preventDefault();
        const target = this.continuity ? this.opening : this.sequence;
        const fraction = this.continuity ? .48 : .44;
        const context = this.scrollContext();
        const stageHeight = this.continuity ? this.openingSticky.clientHeight : context.height;
        const top = target.getBoundingClientRect().top - context.top + context.y + Math.max(0, target.offsetHeight - stageHeight) * fraction;
        (context.root || context.view).scrollTo({ top, behavior: 'smooth' });
      }, { signal });
      this.addEventListener('shopify:block:select', (event) => {
        const index = this.panels.findIndex((panel) => panel === event.target || panel.contains(event.target));
        if (index >= 0) { this.editorSelection = true; this.select(index, false); this.schedule(); }
      }, { signal });
      this.addEventListener('shopify:block:deselect', () => { this.editorSelection = false; this.schedule(); }, { signal });
      this.select(this.continuity ? this.heroIndices.center : 0, false);
      this.observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-inview');
      }), { threshold: .15, root: this.scrollRoot });
      this.querySelectorAll('[data-pc-reveal]').forEach((element) => this.observer.observe(element));
      this.updateMotionPreference();
      this.reducedMotion.addEventListener('change', () => this.updateMotionPreference(), { signal });
      this.pointerFine.addEventListener('change', () => this.resetPointer(true), { signal });
      document.addEventListener('visibilitychange', () => {
        this.resetPointer(true);
        if (document.visibilityState === 'hidden') { cancelAnimationFrame(this.frame); this.frame = 0; }
        else this.schedule();
      }, { signal });
      this.ownerDocument.addEventListener('scroll', () => this.schedule(), { capture: true, passive: true, signal });
      window.addEventListener('scroll', () => this.schedule(), { passive: true, signal });
      window.addEventListener('resize', () => { this.refreshScrollRoot(); this.updateMotionPreference(); }, { passive: true, signal });
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => { this.refreshScrollRoot(); this.updateMotionPreference(); });
        this.resizeObserver.observe(this.scrollRoot || this.ownerDocument.documentElement);
      }
      this.addEventListener('load', () => this.schedule(), { capture: true, signal });
      this.ownerDocument.fonts?.ready.then(() => { if (this.isConnected) this.schedule(); });
      this.schedule();
    }
    setPointerTarget(event) {
      if (!this.motion || !this.pointerFine?.matches || event.pointerType !== 'mouse' || document.visibilityState === 'hidden') return;
      const rect = this.pointerSurface?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;
      this.pointer.targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
      this.pointer.targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
      this.pointerActive = true;
      if (!this.continuity) {
        this.hero?.style.setProperty('--pointer-x', this.pointer.targetX * .5);
        this.hero?.style.setProperty('--pointer-y', this.pointer.targetY * .5);
      }
      this.schedule();
    }
    resetPointer(immediate = false) {
      if (this.pointer) {
        this.pointer.targetX = 0;
        this.pointer.targetY = 0;
        if (immediate) { this.pointer.x = 0; this.pointer.y = 0; }
      }
      this.pointerActive = false;
      if (immediate) this.lastPointerFrame = null;
      this.hero?.style.setProperty('--pointer-x', 0);
      this.hero?.style.setProperty('--pointer-y', 0);
      if (document.visibilityState !== 'hidden') this.schedule();
    }
    createPacketLayer() {
      this.continuity = false;
      if (!this.openingSticky || !this.panels.length) return;
      const sources = this.panels.map((panel) => panel.querySelector('.pc-m-product-packet img, .pc-m-product-packet svg'));
      if (sources.some((source) => !source)) return;
      const find = (text, fallback) => {
        const index = this.panels.findIndex((panel) => (panel.dataset.productTitle || '').toLowerCase().includes(text));
        return index < 0 ? fallback : index;
      };
      this.heroIndices = { left: find('cheese', 0), center: find('sweet', Math.min(1, this.panels.length - 1)), right: find('spicy', Math.min(2, this.panels.length - 1)) };
      const heroTrio = [...new Set([this.heroIndices.left, this.heroIndices.center, this.heroIndices.right])];
      const remainder = this.panels.map((_, index) => index).filter((index) => !heroTrio.includes(index));
      this.visualOrder = [...remainder.slice(0, 3), ...heroTrio, ...remainder.slice(3)];
      this.packetLayer = document.createElement('div');
      this.packetLayer.className = 'pc-m-shared-packets';
      this.packetLayer.setAttribute('aria-hidden', 'true');
      this.sharedPackets = sources.map((source, index) => {
        const packet = document.createElement('div');
        packet.className = 'pc-m-shared-packet';
        packet.dataset.pcPacketIndex = index;
        const image = source.cloneNode(true);
        image.removeAttribute('id');
        image.querySelectorAll?.('[id]').forEach((element) => element.removeAttribute('id'));
        if (image.tagName === 'IMG') { image.alt = ''; image.loading = 'eager'; image.decoding = 'async'; image.removeAttribute('fetchpriority'); }
        packet.append(image);
        this.packetLayer.append(packet);
        return packet;
      });
      this.openingSticky.append(this.packetLayer);
      this.classList.add('has-continuity');
      this.continuity = true;
    }
    step(direction) {
      if (this.continuity && this.motion) {
        const position = this.visualOrder.indexOf(this.selectedIndex);
        this.select(this.visualOrder[(position + direction + this.visualOrder.length) % this.visualOrder.length], true);
      } else this.select(this.selectedIndex + direction, true);
    }
    select(index, announce) {
      if (!this.panels.length) return;
      const nextIndex = wrapFlavor(index, this.panels.length);
      if (this.motion && this.continuity && nextIndex !== this.selectedIndex && this.lastPacketPoses) {
        this.selectionFrom = this.lastPacketPoses.map((pose) => ({ ...pose }));
        this.selectionStarted = performance.now();
      }
      this.selectedIndex = nextIndex;
      this.panels.forEach((panel, position) => {
        const active = position === this.selectedIndex;
        panel.classList.toggle('is-active', active);
        panel.setAttribute('aria-hidden', String(!active));
        panel.inert = !active || (this.continuity && this.motion && !this.detailInteractive);
        const tab = this.tabs[position];
        tab?.classList.toggle('is-active', active);
        tab?.setAttribute('aria-selected', String(active));
        if (tab) tab.tabIndex = active ? 0 : -1;
      });
      const panel = this.panels[this.selectedIndex];
      if (this.sequence) {
        this.sequence.style.setProperty('--pc-flavour', panel.dataset.background);
        this.sequence.style.setProperty('--pc-ink', panel.dataset.ink);
      }
      if (this.opening) {
        this.opening.style.setProperty('--pc-flavour', panel.dataset.background);
        this.opening.style.setProperty('--pc-ink', panel.dataset.ink);
      }
      if (this.rowLabel) this.rowLabel.textContent = panel.dataset.productTitle;
      if (this.previous) this.previous.disabled = this.panels.length < 2;
      if (this.next) this.next.disabled = this.panels.length < 2;
      if (this.rowPrevious) this.rowPrevious.disabled = this.panels.length < 2;
      if (this.rowNext) this.rowNext.disabled = this.panels.length < 2;
      if (announce && this.status) this.status.textContent = (this.dataset.selectedTemplate || '[product]').replace('[product]', panel.dataset.productTitle);
      const tab = this.tabs[this.selectedIndex];
      if (tab && this.tablist) {
        const target = Math.max(0, tab.offsetLeft - this.tablist.offsetLeft - this.tablist.clientWidth / 2 + tab.clientWidth / 2);
        this.tablist.scrollTo({ left: target, behavior: 'auto' });
      }
      this.schedule();
    }
    updateMotionPreference() {
      this.motion = this.dataset.motion === 'true' && !this.reducedMotion.matches && this.scrollContext().height >= 650;
      this.classList.toggle('has-motion', this.motion);
      if (this.packetLayer) this.packetLayer.hidden = !this.motion;
      if (!this.motion) {
        this.resetPointer(true);
        this.selectionFrom = null;
        this.detailInteractive = true;
        if (this.hero) this.hero.inert = false;
        if (this.intro) this.intro.inert = false;
        this.panels.forEach((panel, index) => { panel.inert = index !== this.selectedIndex; });
        this.style.setProperty('--hero-progress', 0);
        this.story?.style.setProperty('--chapter-progress', 0);
        this.hero?.style.setProperty('--pointer-x', 0);
        this.hero?.style.setProperty('--pointer-y', 0);
        this.stage?.classList.add('is-visible');
        if (this.stage) this.stage.inert = false;
        this.storyCards.forEach((card) => { card.classList.add('is-active'); card.removeAttribute('aria-hidden'); card.inert = false; });
        this.words.forEach((word) => word.classList.add('is-lit'));
        if (this.arc) {
          this.arc.style.setProperty('--arc-entry', 1);
          this.arc.style.setProperty('--arc-progress', 0);
          this.arc.style.setProperty('--arc-track-x', '0px');
          this.arc.style.setProperty('--arc-card-progress', 0);
          this.arc.style.setProperty('--arc-shift', '0px');
        }
      }
      this.schedule();
    }
    updateOpening(viewport, time = performance.now(), viewportTop = 0) {
      const rect = this.opening.getBoundingClientRect();
      const top = rect.top - viewportTop;
      const stageHeight = this.openingSticky.clientHeight || viewport;
      const progress = this.editorSelection ? .8 : PapaCornHomepage.clamp(-top / Math.max(1, this.opening.offsetHeight - stageHeight));
      this.openingProgress = progress;
      const width = this.openingSticky.clientWidth;
      const height = this.openingSticky.clientHeight || viewport;
      const pointerEnabled = this.motion && this.pointerFine?.matches && document.visibilityState !== 'hidden' && rect.bottom > viewportTop && top < viewport && progress < .66;
      if (pointerEnabled) {
        const elapsed = this.lastPointerFrame == null ? 16 : Math.max(0, time - this.lastPointerFrame);
        const eased = PapaCornHomepage.easePointer(this.pointer, { x: this.pointer.targetX, y: this.pointer.targetY }, elapsed);
        this.pointer.x = eased.x;
        this.pointer.y = eased.y;
        this.lastPointerFrame = time;
      } else {
        this.pointer.x = this.pointer.y = this.pointer.targetX = this.pointer.targetY = 0;
        this.lastPointerFrame = null;
      }
      const detail = PapaCornHomepage.smooth((progress - .58) / .22);
      const row = PapaCornHomepage.smooth((progress - .24) / .14) * (1 - detail);
      const hero = 1 - PapaCornHomepage.smooth((progress - .04) / .20);
      const controls = PapaCornHomepage.smooth((progress - .64) / .12);
      const props = { '--pc-opening-hero': hero, '--pc-opening-background': 1 - PapaCornHomepage.smooth((progress - .15) / .23), '--pc-opening-row': row, '--pc-opening-detail': detail, '--pc-opening-controls': controls, '--pc-opening-progress': progress, '--pc-opening-copy-y': ((1 - detail) * 65) + 'px' };
      Object.entries(props).forEach(([key, value]) => this.opening.style.setProperty(key, value));
      this.style.setProperty('--hero-progress', 0);
      this.sequence.style.setProperty('--intro-opacity', 1);
      this.sequence.style.setProperty('--intro-y', '0px');
      this.sequence.style.setProperty('--selector-opacity', 1);
      this.sequence.style.setProperty('--selector-y', '0px');
      this.detailInteractive = detail > .35;
      const stageVisible = controls > .15;
      this.stage?.classList.toggle('is-visible', stageVisible);
      if (this.stage) this.stage.inert = !stageVisible;
      if (this.hero) this.hero.inert = hero < .25;
      if (this.intro) this.intro.inert = row < .35;
      this.panels.forEach((panel, index) => { panel.inert = index !== this.selectedIndex || !this.detailInteractive; });
      const selectionAmount = this.selectionFrom ? PapaCornHomepage.smooth((time - this.selectionStarted) / 450) : 1;
      this.composedPacketPoses = [];
      this.lastPacketPoses = this.sharedPackets.map((packet, index) => {
        const pose = PapaCornHomepage.openingPose({ index, selected: this.selectedIndex, order: this.visualOrder, progress, width, height, heroIndices: this.heroIndices });
        if (this.selectionFrom) ['x', 'y', 'size', 'rotation', 'opacity'].forEach((key) => { pose[key] = PapaCornHomepage.mix(this.selectionFrom[index][key], pose[key], selectionAmount); });
        const composed = PapaCornHomepage.composePacketPose(pose, { index, progress, width, height, pointerX: this.pointer.x, pointerY: this.pointer.y, time, enabled: pointerEnabled });
        this.composedPacketPoses.push(composed);
        packet.style.width = composed.size + 'px';
        packet.style.height = composed.size + 'px';
        packet.style.transform = 'translate3d(' + (composed.x - composed.size / 2) + 'px,' + (composed.y - composed.size / 2) + 'px,0) rotate(' + composed.rotation + 'deg)';
        packet.style.opacity = composed.opacity;
        packet.style.zIndex = composed.z;
        return pose;
      });
      if (selectionAmount < 1) this.schedule();
      else this.selectionFrom = null;
      if (pointerEnabled) this.schedule();
    }
    schedule() {
      if (this.frame) return;
      this.frame = requestAnimationFrame((time) => { this.frame = 0; this.updateScroll(time); });
    }
    updateScroll(time = performance.now()) {
      if (!this.motion) { this.classList.add('is-past-hero'); return; }
      const context = this.scrollContext();
      const viewport = context.height;
      const clamp = (value) => Math.max(0, Math.min(1, value));
      const hero = this.querySelector('.pc-m-hero');
      if (this.continuity) this.updateOpening(viewport, time, context.top);
      else if (hero) this.style.setProperty('--hero-progress', clamp((context.top - hero.getBoundingClientRect().top) / viewport));
      this.classList.toggle('is-past-hero', this.continuity ? this.openingProgress > .2 : !this.hero || this.hero.getBoundingClientRect().bottom - context.top < viewport * .5);
      if (this.sequence && !this.continuity) {
        const rect = this.sequence.getBoundingClientRect();
        const progress = sceneProgress(context.top - rect.top, 0, this.sequence.offsetHeight - viewport);
        const reveal = this.editorSelection ? 1 : clamp((progress - .14) / .18);
        this.sequence.style.setProperty('--intro-opacity', this.editorSelection ? 0 : 1 - clamp(progress / .22));
        this.sequence.style.setProperty('--intro-y', (progress * -220) + 'px');
        this.sequence.style.setProperty('--selector-opacity', reveal);
        this.sequence.style.setProperty('--selector-y', ((1 - reveal) * 80) + 'px');
        this.sequence.style.setProperty('--selector-progress', progress);
        const visible = reveal > .25;
        this.stage?.classList.toggle('is-visible', visible);
        if (this.stage) this.stage.inert = !visible;
      }
      if (this.arc) {
        const rect = this.arc.getBoundingClientRect();
        const stageWidth = this.arcSticky?.clientWidth || this.arc.clientWidth;
        const arcMotion = PapaCornHomepage.arcMotion({ top: rect.top - context.top, height: this.arc.offsetHeight, viewport, stageHeight: this.arcSticky?.clientHeight || viewport, trackWidth: this.arcTrack?.scrollWidth || stageWidth, stageWidth, inset: stageWidth * .05 });
        const entry = this.arcSticky ? arcMotion.entry : clamp((viewport * .88 - rect.top + context.top) / (viewport * .7));
        this.words.forEach((word, index) => {
          const fill = clamp(arcMotion.reveal * this.words.length - index);
          word.style.setProperty('--word-fill', fill * 100 + '%');
          word.classList.toggle('is-lit', fill === 1);
        });
        this.arc.style.setProperty('--arc-entry', arcMotion.entry);
        this.arc.style.setProperty('--arc-progress', arcMotion.progress);
        this.arc.style.setProperty('--arc-track-x', arcMotion.x + 'px');
        this.arc.style.setProperty('--arc-card-progress', arcMotion.cardProgress);
        this.arc.style.setProperty('--arc-shift', ((1 - entry) * 45) + 'px');
      }
      if (this.story) {
        const rect = this.story.getBoundingClientRect();
        const stageHeight = this.story.querySelector?.('.pc-m-story-sticky')?.clientHeight || viewport;
        const progress = clamp((context.top - rect.top) / Math.max(1, this.story.offsetHeight - stageHeight));
        const active = Math.min(this.storyCards.length - 1, Math.floor(progress * this.storyCards.length));
        this.story.style.setProperty('--story-color', ['#FFF8E7', '#EEE1FA', '#FFE3C9'][active]);
        this.story.style.setProperty('--chapter-progress', Math.min(1, progress * this.storyCards.length - active));
        this.storyCards.forEach((card, index) => {
          card.classList.toggle('is-active', index === active);
          card.setAttribute('aria-hidden', String(index !== active));
          card.inert = index !== active;
        });
      }
      if (this.final) {
        const progress = clamp((viewport - this.final.getBoundingClientRect().top + context.top) / (viewport * .8));
        this.final.style.setProperty('--footer-y', ((1 - progress) * 35) + 'px');
        this.final.style.setProperty('--footer-scale', .94 + .06 * progress);
      }
    }
  }
  customElements.define('papacorn-homepage', PapaCornHomepage);
}
