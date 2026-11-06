'use strict';
/**
 * JinlingShots — Hybrid Cinematic Deck controller
 * GSAP ScrollTrigger.observe for narrative shots; pause in studio; exhibit rail.
 */
(() => {
  const SHOT_META = {
    hero:     { index: 1, label: '序幕',    chapter: '文脉新生 · 开幕', sub: '江苏 · 南京剪纸', caption: '一纸之间，万象新生。', captionSub: '故乡红纸，此刻展开。' },
    heritage: { index: 2, label: '识非遗',  chapter: '壹 · 序厅',       sub: '先认识它，再剪一张', caption: '先认识它，再剪一张。', captionSub: '红纸上的镂空，连着生活。' },
    exhibits: { index: 3, label: '图录',    chapter: '贰 · 图录',       sub: '细看，才见文脉',   caption: '把目光，留在细节里。', captionSub: '先看纸，再动手。' },
    studio:   { index: 4, label: '工坊',    chapter: '叁 · 工坊',       sub: 'AI 起稿 · 人未落剪', caption: '先让规则起一稿轮廓。', captionSub: '本地规则起稿，非云端大模型。' },
    gallery:  { index: 5, label: '珍藏',    chapter: '肆 · 珍藏',       sub: '光过纸隙 · 文脉透亮', caption: '让这一剪，留下来。', captionSub: '文脉，在手里新生。' },
    closing:  { index: 6, label: '片尾',    chapter: 'Credits',         sub: '纸上金陵',         caption: '看见技术，也尊重手艺。', captionSub: '非遗数字化 · 文脉新生' }
  };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 900px)').matches;
  let readMode = false;
  try { readMode = localStorage.getItem('jinling-read-mode') === '1'; } catch (_) {}

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  let shots = [];
  let index = 0;
  let animating = false;
  let paused = false;
  let obs = null;
  let cinematic = false;
  let exhibitRailIndex = 0;
  let exhibitObs = null;
  let chapterCardTimer = 0;
  let lastEnterAt = 0;

  function shotId(el) { return el && el.dataset ? el.dataset.shot : ''; }
  function findIndex(idOrIndex) {
    if (typeof idOrIndex === 'number') return idOrIndex;
    if (idOrIndex && typeof idOrIndex === 'object' && 'index' in idOrIndex) return idOrIndex.index;
    const id = String(idOrIndex || '');
    return shots.findIndex((s) => shotId(s) === id);
  }

  function setHud(id) {
    const meta = SHOT_META[id] || { index: index + 1, label: id || '—', caption: '', captionSub: '' };
    const hud = qs('#shot-hud');
    const live = qs('#shot-hud-live');
    const num = String(meta.index).padStart(2, '0');
    const text = `${num} / 06 · ${meta.label}`;
    if (hud) {
      const n = qs('.shot-hud-num', hud);
      const l = qs('.shot-hud-label', hud);
      if (n) n.textContent = `${num} / 06`;
      if (l) l.textContent = meta.label;
      hud.hidden = false;
    }
    if (live) live.textContent = `第 ${meta.index} 镜：${meta.label}`;
    const cap = qs('#shot-caption');
    if (cap) {
      const main = qs('.shot-caption-main', cap);
      const sub = qs('.shot-caption-sub', cap);
      if (main) main.textContent = meta.caption || '';
      if (sub) sub.textContent = meta.captionSub || '';
      cap.classList.remove('is-on');
      void cap.offsetWidth;
      cap.classList.add('is-on');
    }
    const header = qs('.header');
    if (header) header.classList.toggle('on-dark', id === 'exhibits');
    qsa('.museum-route a').forEach((a) => {
      const href = (a.getAttribute('href') || '').replace('#', '');
      a.classList.toggle('is-active', href === id || (id === 'closing' && href === 'gallery'));
    });
    qsa('.header nav a').forEach((a) => {
      const href = (a.getAttribute('href') || '').replace('#', '');
      a.classList.toggle('is-active', href === id || (id === 'closing' && href === 'gallery'));
    });
  }

  function playChapterCard(id, skipAnim) {
    const card = qs('#shot-chapter-card');
    if (!card) return;
    const meta = SHOT_META[id];
    if (!meta) return;
    clearTimeout(chapterCardTimer);
    qs('.shot-chapter-title', card).textContent = meta.chapter;
    qs('.shot-chapter-sub', card).textContent = meta.sub;
    card.hidden = false;
    card.classList.remove('is-show', 'is-instant');
    void card.offsetWidth;
    if (skipAnim || reducedMotion || !cinematic) {
      card.classList.add('is-instant', 'is-show');
      chapterCardTimer = setTimeout(() => {
        card.classList.remove('is-show', 'is-instant');
        card.hidden = true;
      }, 420);
      return;
    }
    card.classList.add('is-show');
    chapterCardTimer = setTimeout(() => {
      card.classList.remove('is-show');
      setTimeout(() => { card.hidden = true; }, 280);
    }, 700);
  }

  /** Full-screen transition overlay: cover → swap → reveal */
  function ensureTransitionEl() {
    let root = qs('#shot-transition');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'shot-transition';
    root.className = 'shot-transition';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<div class="shot-transition-veil" data-dir="fwd"></div>';
    document.body.appendChild(root);
    return root;
  }

  /**
   * Play veil cut. Order (cinematic contract):
   * 1) cover overlay  2) onCovered: swap DOM / HUD prep  3) reveal  4) onRevealed
   * reduced-motion / no-gsap callers should not use this.
   */
  function playVeilCut(dir, { onCovered, onRevealed } = {}) {
    const root = ensureTransitionEl();
    const veil = qs('.shot-transition-veil', root) || root;
    veil.dataset.dir = dir >= 0 ? 'fwd' : 'back';
    root.classList.add('is-active');
    document.documentElement.dataset.transitionPhase = 'cover';
    if (typeof gsap === 'undefined') {
      document.documentElement.dataset.transitionPhase = 'swap';
      try { onCovered && onCovered(); } catch (e) { console.warn(e); }
      document.documentElement.dataset.transitionPhase = 'reveal';
      root.classList.remove('is-active');
      delete document.documentElement.dataset.transitionPhase;
      try { onRevealed && onRevealed(); } catch (e) { console.warn(e); }
      return;
    }
    gsap.killTweensOf(veil);
    gsap.set(veil, { opacity: 0, scale: dir >= 0 ? 1.04 : 0.98 });
    const tl = gsap.timeline({
      onComplete: () => {
        root.classList.remove('is-active');
        delete document.documentElement.dataset.transitionPhase;
      }
    });
    // Phase A: cover (content still = previous shot)
    tl.to(veil, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.in' }, 0);
    tl.add(() => {
      document.documentElement.dataset.transitionPhase = 'swap';
      try { onCovered && onCovered(); } catch (e) { console.warn(e); }
    });
    // Hold opaque briefly so swap is never seen (phase stays "swap")
    tl.to({}, { duration: 0.08 });
    tl.add(() => { document.documentElement.dataset.transitionPhase = 'reveal'; });
    // Phase B: reveal new shot under veil
    tl.to(veil, { opacity: 0, scale: dir >= 0 ? 0.98 : 1.03, duration: 0.34, ease: 'power2.out' });
    tl.add(() => {
      try { onRevealed && onRevealed(); } catch (e) { console.warn(e); }
    });
  }

  function leaveShot(el) {
    if (!el) return;
    const id = shotId(el);
    window.dispatchEvent(new CustomEvent('shot:leave', { detail: { id } }));
    el.classList.remove('is-shot-active');
    if (id === 'exhibits') disableExhibitRail();
  }

  function enterShot(el, opts = {}) {
    if (!el) return;
    const id = shotId(el);
    el.classList.add('is-shot-active', 'is-onstage');
    el.classList.remove('stage-ready');
    if (!opts.deferPresent) {
      setHud(id);
      const now = performance.now();
      const skipCard = opts.skipCard || (now - lastEnterAt < 400);
      lastEnterAt = now;
      if (!opts.silentCard && id !== 'hero') playChapterCard(id, skipCard);
    }
    window.dispatchEvent(new CustomEvent('shot:enter', { detail: { id } }));
    if (id === 'studio') {
      pause();
      try { el.scrollTop = 0; } catch (_) {}
    }
    if (id === 'exhibits') enableExhibitRail();
    // Focus main heading for a11y
    const focusEl = el.querySelector('h1, h2, #finish-work, .hero-actions .button');
    if (focusEl && typeof focusEl.focus === 'function' && !opts.noFocus) {
      try { focusEl.setAttribute('tabindex', focusEl.getAttribute('tabindex') || '-1'); focusEl.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  /** HUD / chapter card / caption after veil has revealed the new shot */
  function presentShot(el, opts = {}) {
    if (!el) return;
    const id = shotId(el);
    setHud(id);
    const now = performance.now();
    const skipCard = opts.skipCard || (now - lastEnterAt < 400);
    lastEnterAt = now;
    if (!opts.silentCard && id !== 'hero') playChapterCard(id, skipCard);
    const focusEl = el.querySelector('h1, h2, #finish-work, .hero-actions .button');
    if (focusEl && typeof focusEl.focus === 'function' && !opts.noFocus) {
      try { focusEl.setAttribute('tabindex', focusEl.getAttribute('tabindex') || '-1'); focusEl.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  function goto(idOrIndex, opts = {}) {
    const i = findIndex(idOrIndex);
    if (i < 0 || i >= shots.length) return false;
    if (!cinematic) {
      // Document flow: native scroll
      const el = shots[i];
      const prev = shots[index];
      if (prev && prev !== el) leaveShot(prev);
      index = i;
      el.scrollIntoView({ behavior: reducedMotion || opts.instant ? 'instant' : 'smooth', block: 'start' });
      enterShot(el, { skipCard: !!opts.skipCard, silentCard: !!opts.silentCard, noFocus: !!opts.noFocus });
      try {
        const id = shotId(el);
        if (id && history.replaceState) history.replaceState(null, '', '#' + (id === 'hero' ? '' : id));
      } catch (_) {}
      return true;
    }
    if (animating) return false;
    if (i === index && !opts.force) {
      // Re-entering same shot (e.g. after resume)
      enterShot(shots[i], { skipCard: true, silentCard: true, noFocus: true });
      return true;
    }
    // Leaving studio should resume unless going to showcase-only
    const prev = shots[index];
    const next = shots[i];
    const dir = opts.dir != null ? opts.dir : (i > index ? 1 : -1);
    const prevId = shotId(prev);

    // If paused in studio and navigating away via goto, allow and resume after leave
    const wasPaused = paused;
    if (wasPaused && shotId(next) !== 'studio') {
      paused = false;
      if (obs && obs.enable) try { obs.enable(); } catch (_) {}
    }

    animating = true;
    document.documentElement.classList.add('is-shot-locking');

    const gsapOk = typeof gsap !== 'undefined';

    const applyHash = () => {
      try {
        const id = shotId(next);
        if (history.replaceState) history.replaceState(null, '', id === 'hero' ? location.pathname + location.search : '#' + id);
      } catch (_) {}
    };

    /** Instant path: swap immediately (reduced-motion / no gsap / opts.instant) */
    const finishInstant = () => {
      leaveShot(prev);
      if (gsapOk) {
        gsap.set(prev, { autoAlpha: 0, yPercent: 0, zIndex: 1 });
        gsap.set(next, { autoAlpha: 1, yPercent: 0, zIndex: 3 });
      } else {
        prev.style.opacity = '0';
        prev.style.visibility = 'hidden';
        prev.style.transform = '';
        next.style.opacity = '1';
        next.style.visibility = 'visible';
        next.style.transform = '';
      }
      index = i;
      animating = false;
      document.documentElement.classList.remove('is-shot-locking');
      enterShot(next, opts);
      applyHash();
    };

    if (!gsapOk || reducedMotion || opts.instant) {
      finishInstant();
      return true;
    }

    // Veil-first contract:
    // BEFORE: keep prev as sole active shot; do NOT activate next or update HUD.
    // COVER: play overlay to opaque while prev still on screen.
    // SWAP (onCovered): leave prev → show next under opaque veil → enterShot(deferPresent).
    // REVEAL: fade veil out → presentShot (HUD / chapter card / focus).
    shots.forEach((s, si) => {
      if (si !== index) {
        s.classList.remove('is-shot-active');
        s.style.zIndex = '1';
      } else {
        s.style.zIndex = '2';
      }
    });
    // Keep next invisible until covered
    if (gsapOk) gsap.set(next, { autoAlpha: 0, yPercent: 0, zIndex: 1 });
    else {
      next.style.opacity = '0';
      next.style.visibility = 'hidden';
    }

    playVeilCut(dir, {
      onCovered: () => {
        leaveShot(prev);
        if (gsapOk) {
          gsap.set(prev, { autoAlpha: 0, yPercent: 0, zIndex: 1 });
          gsap.set(next, { autoAlpha: 1, yPercent: 0, zIndex: 3 });
        } else {
          prev.style.opacity = '0';
          prev.style.visibility = 'hidden';
          next.style.opacity = '1';
          next.style.visibility = 'visible';
        }
        index = i;
        // Under opaque veil: activate next shot + HUD + pause/rail; chapter card waits for reveal
        enterShot(next, {
          silentCard: true,
          noFocus: true,
          skipCard: true
        });
        applyHash();
      },
      onRevealed: () => {
        // Entrance after veil lifts: chapter card + focus
        const id = shotId(next);
        if (!opts.silentCard && id !== 'hero') {
          playChapterCard(id, !!opts.skipCard);
        }
        if (!opts.noFocus) {
          const focusEl = next.querySelector('h1, h2, #finish-work, .hero-actions .button');
          if (focusEl && typeof focusEl.focus === 'function') {
            try { focusEl.setAttribute('tabindex', focusEl.getAttribute('tabindex') || '-1'); focusEl.focus({ preventScroll: true }); } catch (_) {}
          }
        }
        animating = false;
        document.documentElement.classList.remove('is-shot-locking');
      }
    });
    return true;
  }

  function pause() {
    paused = true;
    document.documentElement.classList.add('is-shot-paused');
    if (obs && obs.disable) try { obs.disable(); } catch (_) {}
  }

  function resume() {
    if (!cinematic) return;
    paused = false;
    document.documentElement.classList.remove('is-shot-paused');
    if (obs && obs.enable) try { obs.enable(); } catch (_) {}
  }

  function disableExhibitRail() {
    exhibitObs = null;
    const track = qs('.exhibit-track') || qs('#exhibit-grid');
    if (track) track.classList.remove('is-rail-active');
    document.documentElement.classList.remove('is-exhibit-rail');
  }

  function enableExhibitRail() {
    if (!cinematic || reducedMotion) return;
    const track = qs('.exhibit-track') || qs('#exhibit-grid');
    if (!track) return;
    track.classList.add('is-rail-active');
    document.documentElement.classList.add('is-exhibit-rail');
    exhibitRailIndex = 0;
    snapExhibit(0, true);
  }

  function snapExhibit(i, instant) {
    const track = qs('.exhibit-track') || qs('#exhibit-grid');
    if (!track) return;
    const cards = qsa('.exhibit-card', track);
    if (!cards.length) return;
    exhibitRailIndex = Math.max(0, Math.min(cards.length - 1, i));
    const card = cards[exhibitRailIndex];
    const left = card.offsetLeft - (track.parentElement ? 24 : 0);
    if (typeof gsap !== 'undefined' && !instant && !reducedMotion) {
      gsap.to(track, { x: -left, duration: 0.4, ease: 'power2.out', overwrite: true });
    } else {
      track.style.transform = `translate3d(${-left}px,0,0)`;
    }
    cards.forEach((c, ci) => c.classList.toggle('is-rail-focus', ci === exhibitRailIndex));
  }

  function exhibitNext(dir) {
    snapExhibit(exhibitRailIndex + dir, false);
  }

  function wireNav() {
    const handler = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = (a.getAttribute('href') || '').slice(1);
      if (!id) {
        e.preventDefault();
        goto('hero');
        return;
      }
      const mapped = id === 'gallery' ? 'gallery' : id;
      if (findIndex(mapped) < 0) return;
      e.preventDefault();
      // Leaving studio via nav
      if (paused && shotId(shots[index]) === 'studio' && mapped !== 'studio') {
        paused = false;
        document.documentElement.classList.remove('is-shot-paused');
        if (obs && obs.enable) try { obs.enable(); } catch (_) {}
      }
      goto(mapped);
    };
    document.querySelector('.header')?.addEventListener('click', handler);
    document.querySelector('.museum-route')?.addEventListener('click', handler);
    document.querySelector('.hero-actions')?.addEventListener('click', handler);
    document.querySelector('.closing')?.addEventListener('click', handler);
    qs('.brand')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (paused) { paused = false; document.documentElement.classList.remove('is-shot-paused'); if (obs?.enable) obs.enable(); }
      goto('hero');
    });
  }

  function wireKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!cinematic) return;
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.target?.isContentEditable) return;
      if (qs('dialog[open]')) return;
      if (document.documentElement.classList.contains('is-shot-locking')) return;

      if (document.documentElement.classList.contains('is-exhibit-rail') && shotId(shots[index]) === 'exhibits') {
        if (e.key === 'ArrowRight') { e.preventDefault(); exhibitNext(1); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); exhibitNext(-1); return; }
      }

      if (paused) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goto(index + 1, { dir: 1 });
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goto(index - 1, { dir: -1 });
      } else if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        goto(Number(e.key) - 1, { dir: Number(e.key) - 1 > index ? 1 : -1 });
      }
    });
  }

  function createObserver() {
    if (typeof ScrollTrigger === 'undefined' || typeof gsap === 'undefined') {
      console.warn('[JinlingShots] GSAP/ScrollTrigger missing — cinematic deck disabled');
      return null;
    }
    gsap.registerPlugin(ScrollTrigger);
    const tryStep = (dir) => {
      if (paused || animating) return;
      if (document.documentElement.classList.contains('is-exhibit-rail') && shotId(shots[index]) === 'exhibits') {
        const n = qsa('.exhibit-card').length;
        if (dir > 0) {
          if (exhibitRailIndex < n - 1) { exhibitNext(1); return; }
          goto(index + 1, { dir: 1 });
        } else {
          if (exhibitRailIndex > 0) { exhibitNext(-1); return; }
          goto(index - 1, { dir: -1 });
        }
        return;
      }
      goto(index + dir, { dir });
    };
    return ScrollTrigger.observe({
      target: document.documentElement,
      type: 'wheel,touch',
      wheelSpeed: -1,
      tolerance: 10,
      preventDefault: true,
      ignore: 'input,textarea,select,button,#paper,.studio-shell,.exhibit-dialog,.showcase-dialog,#ai-inspire,.ai-inspire-bar',
      onUp: () => tryStep(1),
      onDown: () => tryStep(-1)
    });
  }

  function setMode(cinematicOn, persist) {
    cinematic = !!cinematicOn && !reducedMotion && !narrow;
    document.documentElement.classList.toggle('is-cinematic', cinematic);
    document.documentElement.classList.toggle('is-read-mode', !cinematic);
    const toggle = qs('#shot-mode-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', cinematic ? 'true' : 'false');
      toggle.textContent = cinematic ? '电影分镜' : '简洁阅读';
    }
    if (persist) {
      try { localStorage.setItem('jinling-read-mode', cinematic ? '0' : '1'); } catch (_) {}
    }
    if (cinematic) {
      // Stack shots
      shots.forEach((s, si) => {
        s.classList.add('shot-panel');
        if (si !== index) {
          s.classList.remove('is-shot-active');
          if (typeof gsap !== 'undefined') gsap.set(s, { autoAlpha: 0, yPercent: 0 });
          else { s.style.opacity = '0'; s.style.visibility = 'hidden'; }
        } else {
          s.classList.add('is-shot-active');
          if (typeof gsap !== 'undefined') gsap.set(s, { autoAlpha: 1, yPercent: 0 });
          else { s.style.opacity = '1'; s.style.visibility = 'visible'; }
        }
      });
      if (!obs) obs = createObserver();
      else if (obs.enable) obs.enable();
      paused = false;
      document.documentElement.classList.remove('is-shot-paused');
      enterShot(shots[index], { skipCard: true, silentCard: index === 0, noFocus: true });
    } else {
      if (obs && obs.disable) obs.disable();
      disableExhibitRail();
      shots.forEach((s) => {
        s.classList.add('is-shot-active', 'is-onstage');
        s.style.opacity = '';
        s.style.visibility = '';
        s.style.transform = '';
        s.style.zIndex = '';
        if (typeof gsap !== 'undefined') gsap.set(s, { clearProps: 'all' });
      });
      document.documentElement.classList.remove('is-shot-locking', 'is-shot-paused');
    }
  }

  function bootDeepLink() {
    const hash = (location.hash || '').replace('#', '');
    const map = { heritage: 'heritage', exhibits: 'exhibits', studio: 'studio', gallery: 'gallery', closing: 'closing', hero: 'hero' };
    const id = map[hash];
    if (id && findIndex(id) >= 0) {
      index = findIndex(id);
      goto(id, { force: true, instant: true, skipCard: true, noFocus: true });
      if (id === 'studio') pause();
    } else {
      index = 0;
      if (cinematic) enterShot(shots[0], { silentCard: true, skipCard: true, noFocus: true });
      else shots.forEach((s) => s.classList.add('is-onstage'));
    }
  }

  function init() {
    const main = qs('main');
    if (main) main.classList.add('shot-deck');
    // Ensure data-shot present
    const ensure = [
      ['.hero', 'hero'],
      ['#heritage', 'heritage'],
      ['#exhibits', 'exhibits'],
      ['#studio', 'studio'],
      ['#gallery', 'gallery'],
      ['.closing', 'closing']
    ];
    ensure.forEach(([sel, id]) => {
      const el = qs(sel);
      if (el && !el.dataset.shot) el.dataset.shot = id;
      if (el && id === 'hero' && !el.id) el.id = 'hero';
    });
    shots = qsa('[data-shot]');
    if (!shots.length) return;

    wireNav();
    wireKeyboard();

    const toggle = qs('#shot-mode-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const next = !document.documentElement.classList.contains('is-cinematic');
        // If user forces cinematic on narrow, still allow but warn via class
        if (next && (reducedMotion)) {
          try { localStorage.setItem('jinling-read-mode', '0'); } catch (_) {}
          // still respect reduced motion — stay read
          setMode(false, true);
          return;
        }
        if (next && narrow) {
          document.documentElement.classList.add('is-cinematic-forced');
        }
        cinematic = next;
        if (next && narrow) {
          // allow forced cinematic on narrow for demo
          document.documentElement.classList.add('is-cinematic');
          document.documentElement.classList.remove('is-read-mode');
          shots.forEach((s, si) => {
            s.classList.add('shot-panel');
            if (si !== index) {
              s.classList.remove('is-shot-active');
              if (typeof gsap !== 'undefined') gsap.set(s, { autoAlpha: 0 });
            } else {
              s.classList.add('is-shot-active');
              if (typeof gsap !== 'undefined') gsap.set(s, { autoAlpha: 1, yPercent: 0 });
            }
          });
          if (!obs) obs = createObserver();
          else obs.enable?.();
          try { localStorage.setItem('jinling-read-mode', '0'); } catch (_) {}
          toggle.setAttribute('aria-pressed', 'true');
          toggle.textContent = '电影分镜';
          enterShot(shots[index], { skipCard: true, noFocus: true });
        } else {
          setMode(next, true);
        }
      });
    }

    // Initial mode
    const wantCinematic = !readMode && !reducedMotion && !narrow;
    setMode(wantCinematic, false);
    bootDeepLink();

    // Expose API
    window.JinlingShots = {
      goto: (id, opts) => goto(id, opts || {}),
      playVeilCut,
      transitionPhase: () => document.documentElement.dataset.transitionPhase || '',
      pause,
      resume,
      enableExhibitRail,
      disableExhibitRail,
      exhibitNext,
      snapExhibit,
      isPaused: () => paused,
      isCinematic: () => cinematic,
      current: () => shotId(shots[index]),
      index: () => index,
      setMode: (on) => setMode(!!on, true),
      meta: SHOT_META
    };
    window.dispatchEvent(new Event('jinling-shots-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
