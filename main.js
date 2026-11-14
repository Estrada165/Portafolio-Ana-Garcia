/* ============================================================
   Portfolio Ana Lucía García — v3
   Contenido local (data/local-content.json) + Supabase por REST
   (works, work_assets, pdf_documents, pdf_pages, site_settings).
   La escritura vive en admin.html.
   ============================================================ */
(() => {
  'use strict';

  const CFG = window.PORTFOLIO_CONFIG || {};
  const HAS_SB = !!CFG.SUPABASE_URL && !!CFG.SUPABASE_ANON &&
                 !CFG.SUPABASE_URL.includes('TU_PROYECTO') && !CFG.SUPABASE_ANON.includes('TU_ANON');

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const icon = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  /* ── Datos ─────────────────────────────────────────────────── */
  async function rest(path) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/${path}`, {
        signal: ctl.signal,
        headers: { apikey: CFG.SUPABASE_ANON, Authorization: `Bearer ${CFG.SUPABASE_ANON}` },
      });
      if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  const safe = (p, fallback) => p.catch(e => { console.warn('[portfolio]', e.message || e); return fallback; });

  const norm = r => ({
    id: r.id, src: r.image_url, thumb: r.thumb_url || null,
    title: r.title || '', desc: r.description || '', category: r.category || '',
    width: r.width || null, height: r.height || null,
    tags: r.tags || [], variations: r.variations || [],
  });

  async function loadAll() {
    const empty = { mockups: [], designs: [], illustrations: [], featured: [], logos: [] };
    const [local, works, assets, docs, settings] = await Promise.all([
      safe(fetch('data/local-content.json').then(r => r.json()), empty),
      HAS_SB ? safe(rest('works?select=*&visible=eq.true&order=sort_order.asc,created_at.asc'), []) : [],
      HAS_SB ? safe(rest('work_assets?select=*&order=sort_order.asc'), []) : [],
      HAS_SB ? safe(rest('pdf_documents?select=*&visible=eq.true&order=sort_order.asc,created_at.asc'), []) : [],
      HAS_SB ? safe(rest('site_settings?select=key,value'), []) : [],
    ]);

    const kindMap = { mockup: 'mockups', design: 'designs', illustration: 'illustrations', featured: 'featured', logo: 'logos' };
    const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]));
    // Lo importado o escondido desde el panel deja de salir de la carpeta local
    const ls = cfg.local_state || {}, gone = new Set([...(ls.imported || []), ...(ls.hidden || [])]);
    const data = {};
    for (const k of Object.keys(empty)) data[k] = (local[k] || []).filter(x => !gone.has(x.image_url)).map(norm);
    for (const w of works) {
      const k = kindMap[w.kind]; if (!k || !w.image_url) continue;
      const it = norm(w);
      if (k === 'logos') {
        it.title = w.title; it.desc = w.description || '';
        it.variations = assets.filter(a => a.work_id === w.id).map(a => ({ label: a.label, image_url: a.image_url }));
      }
      data[k].push(it);
    }
    return { data, docs: docs.filter(d => d.page_count > 0 || d.source_url), settings: cfg };
  }

  /* ── Tema personalizado (site_settings.theme) ─────────────────
     Solo se aplica si el panel lo marcó con "customized": true; así
     los valores de ejemplo del esquema no pisan el diseño por defecto. */
  const okColor = v => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v.trim()) ? v.trim() : null;
  const okFont  = v => typeof v === 'string' && /^[\w\s-]{2,40}$/.test(v.trim()) ? v.trim() : null;

  function applyTheme(theme) {
    if (!theme || theme.customized !== true) return;
    const c = theme.colors || {}, d = c.dark || {};
    const pick = (obj, map) => Object.entries(map).map(([k, css]) => okColor(obj[k]) ? `${css}:${okColor(obj[k])};` : '').join('');
    const light = pick(c, { accent: '--accent', accentLight: '--accent-2', bg: '--bg', bgCard: '--card', bgSoft: '--soft', text: '--text', text2: '--text-2' });
    const dark  = pick(d, { bg: '--bg', bgCard: '--card', bgSoft: '--soft', text: '--text', text2: '--text-2' });
    const radius = { sharp: '4px', soft: '14px', round: '26px' }[theme.radius];
    const fd = okFont(theme.fonts?.display), fb = okFont(theme.fonts?.body);
    let css = `:root{${light}${radius ? `--r:${radius};` : ''}${fd ? `--f-display:'${fd}',system-ui,sans-serif;` : ''}${fb ? `--f-body:'${fb}',system-ui,sans-serif;` : ''}}`;
    if (dark) css += `[data-theme="dark"]{${dark}}`;
    for (const [id, o] of Object.entries(theme.sections || {})) {
      if (!/^[\w-]+$/.test(id)) continue;
      const rule = (okColor(o.bg) ? `background:${okColor(o.bg)};` : '') + (okColor(o.text) ? `color:${okColor(o.text)};--text:${okColor(o.text)};` : '') + (okColor(o.accent) ? `--accent:${okColor(o.accent)};` : '');
      if (rule) css += `[data-theme-section="${id}"]{${rule}}`;
    }
    let el = $('#themeVars'); if (!el) { el = document.createElement('style'); el.id = 'themeVars'; document.head.appendChild(el); }
    el.textContent = css;
    const fams = [];
    if (fd && fd !== 'Bricolage' && fd !== 'Bricolage Grotesque') fams.push(`family=${encodeURIComponent(fd).replace(/%20/g, '+')}:wght@400;600;700`);
    if (fb && fb !== 'Geist') fams.push(`family=${encodeURIComponent(fb).replace(/%20/g, '+')}:wght@300;400;500;600`);
    if (fams.length) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`; document.head.appendChild(l); }
  }

  /* ── Visor: zoom real (rueda, pellizco, arrastre, doble toque) ─ */
  const V = {
    el: $('#viewer'), stage: $('#vStage'), img: $('#vImg'),
    items: [], i: 0, s: 1, tx: 0, ty: 0, opener: null, tok: 0,
    bg: () => $$('.nav, main, .footer, .menu, .skip-link'),

    open(items, i, opener) {
      if (!items.length) return;
      this.items = items; this.opener = opener || document.activeElement;
      this.el.hidden = false; document.body.classList.add('no-scroll');
      this.bg().forEach(n => n.setAttribute('inert', ''));
      const multi = items.length > 1;
      this.el.classList.toggle('single', !multi);
      this.el.classList.toggle('show-thumbs', multi && innerHeight > 620);
      $('#vThumbsBtn').setAttribute('aria-pressed', this.el.classList.contains('show-thumbs'));
      $('#vThumbs').innerHTML = multi ? items.map((it, n) =>
        `<button data-n="${n}" aria-label="Ir a ${n + 1} de ${items.length}"><img src="${esc(it.thumb || it.src)}" alt="" loading="lazy" decoding="async"></button>`).join('') : '';
      this.show(i);
      $('#vClose').focus({ preventScroll: true });
    },

    show(i) {
      const n = this.items.length; this.i = (i + n) % n;
      const it = this.items[this.i], token = ++this.tok;
      this.reset(false);
      this.el.classList.add('loading');
      this.img.alt = it.alt || it.title || '';
      this.el.dataset.bg = it.bg || '';
      if (it.thumb && it.thumb !== it.src) { this.img.style.opacity = 1; this.img.src = it.thumb; }
      else this.img.style.opacity = 0;
      const full = new Image();
      full.onload = full.onerror = () => {
        if (token !== this.tok) return;
        this.img.src = it.src; this.img.style.opacity = 1; this.el.classList.remove('loading');
      };
      full.src = it.src;
      $('#vTitle').textContent = it.title || it.category || '';
      $('#vCount').textContent = n > 1 ? `${this.i + 1} / ${n}` : (it.desc || '');
      $('#vOpen').href = it.src;
      $$('#vThumbs button').forEach((b, k) => {
        const on = k === this.i; b.setAttribute('aria-current', on);
        if (on) b.parentElement.scrollTo({ left: b.offsetLeft - b.parentElement.clientWidth / 2 + b.clientWidth / 2, behavior: 'auto' });
      });
      [1, -1].forEach(d => { const q = this.items[(this.i + d + n) % n]; if (q && n > 1) new Image().src = q.src; });
    },

    go(d) { if (this.items.length > 1) this.show(this.i + d); },

    close() {
      this.el.hidden = true; this.tok++;
      this.img.removeAttribute('src');
      document.body.classList.remove('no-scroll');
      this.bg().forEach(n => n.removeAttribute('inert'));
      this.opener?.focus?.({ preventScroll: true });
      if (this.reopen) { const d = this.reopen; this.reopen = null; d.showModal(); }
    },

    reset(animate = true) { this.s = 1; this.tx = this.ty = 0; this.apply(animate); },

    limits() {
      const r = this.stage.getBoundingClientRect();
      const w = this.img.offsetWidth * this.s, h = this.img.offsetHeight * this.s;
      return { mx: Math.max(0, (w - r.width) / 2), my: Math.max(0, (h - r.height) / 2), r };
    },

    apply(animate = false) {
      const { mx, my } = this.limits();
      this.tx = clamp(this.tx, -mx, mx); this.ty = clamp(this.ty, -my, my);
      this.img.style.transition = animate && !reduceMotion ? 'transform .3s cubic-bezier(.22,1,.36,1), opacity .25s' : 'opacity .25s';
      this.img.style.transform = `translate(${this.tx}px,${this.ty}px) scale(${this.s})`;
      $('#vZoomLevel').textContent = `${Math.round(this.s * 100)}%`;
      this.el.classList.toggle('zoomed', this.s > 1.01);
    },

    /* Zoom manteniendo fijo el punto (cx, cy), medido desde el centro del escenario */
    zoomAt(ns, cx, cy, animate) {
      ns = clamp(ns, 1, 6); const k = ns / this.s;
      this.tx = cx - (cx - this.tx) * k; this.ty = cy - (cy - this.ty) * k; this.s = ns;
      if (ns === 1) this.tx = this.ty = 0;
      this.apply(animate);
    },
    rel(x, y) { const r = this.stage.getBoundingClientRect(); return [x - (r.left + r.width / 2), y - (r.top + r.height / 2)]; },
    step(f) { this.zoomAt(this.s * f, 0, 0, true); },
  };

  (() => {
    const { el, stage } = V, ptrs = new Map();
    let moved = false, startX = 0, startY = 0, pinch = null;
    const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

    stage.addEventListener('pointerdown', e => {
      stage.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = false; startX = e.clientX; startY = e.clientY; }
      if (ptrs.size === 2) { pinch = { d: dist(), s: V.s }; moved = true; }
      el.classList.toggle('dragging', V.s > 1);
    });
    stage.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const [cx, cy] = V.rel((a.x + b.x) / 2, (a.y + b.y) / 2);
        V.zoomAt(pinch.s * dist() / pinch.d, cx, cy, false);
      } else if (ptrs.size === 1) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) moved = true;
        if (V.s > 1) { V.tx += dx; V.ty += dy; V.apply(false); }
      }
    });
    const end = e => {
      if (!ptrs.has(e.pointerId)) return;
      const wasSingle = ptrs.size === 1; ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      el.classList.remove('dragging');
      if (!wasSingle || e.type === 'pointercancel') return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (V.s <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) return V.go(dx < 0 ? 1 : -1);
      if (moved) return;
      if (e.target === V.img) {
        if (V.s > 1.01) V.reset(); else { const [cx, cy] = V.rel(e.clientX, e.clientY); V.zoomAt(2.6, cx, cy, true); }
      } else if (V.s <= 1.01) V.close();
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const [cx, cy] = V.rel(e.clientX, e.clientY);
      V.zoomAt(V.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018)), cx, cy, false);
    }, { passive: false });
    V.img.addEventListener('dragstart', e => e.preventDefault());

    $('#vClose').addEventListener('click', () => V.close());
    $('#vPrev').addEventListener('click', () => V.go(-1));
    $('#vNext').addEventListener('click', () => V.go(1));
    $('#vZoomIn').addEventListener('click', () => V.step(1.5));
    $('#vZoomOut').addEventListener('click', () => V.step(1 / 1.5));
    $('#vZoomLevel').addEventListener('click', () => V.reset());
    $('#vThumbsBtn').addEventListener('click', e => {
      const on = el.classList.toggle('show-thumbs'); e.currentTarget.setAttribute('aria-pressed', on); V.apply(false);
    });
    $('#vThumbs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) V.show(+b.dataset.n); });
    addEventListener('resize', () => { if (!el.hidden) V.apply(false); });

    document.addEventListener('keydown', e => {
      if (el.hidden) return;
      const k = e.key, pan = 80;
      if (k === 'Escape') V.close();
      else if (k === '+' || k === '=') V.step(1.4);
      else if (k === '-' || k === '_') V.step(1 / 1.4);
      else if (k === '0') V.reset();
      else if (k === 't' || k === 'T') $('#vThumbsBtn').click();
      else if (k === 'ArrowLeft')  { if (V.s > 1.01) { V.tx += pan; V.apply(false); } else V.go(-1); }
      else if (k === 'ArrowRight') { if (V.s > 1.01) { V.tx -= pan; V.apply(false); } else V.go(1); }
      else if (k === 'ArrowUp' && V.s > 1.01)   { V.ty += pan; V.apply(false); }
      else if (k === 'ArrowDown' && V.s > 1.01) { V.ty -= pan; V.apply(false); }
      else if (k === 'Tab') {                                // el foco no sale del visor
        const f = $$('button:not([hidden]), a[href]', el).filter(n => n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      } else return;
      if (k !== 'Tab') e.preventDefault();
    });
  })();

  const GROUPS = {};   // grupo → items del visor
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    V.open(GROUPS[b.dataset.v] || [], +b.dataset.i || 0, b);
  });

  /* ── Utilidades de render ──────────────────────────────────── */
  const withAlt = (items, label) => items.map((it, n) => ({ ...it, alt: it.title || `${label} ${n + 1}` }));
  const dims = it => it.width && it.height ? ` width="${it.width}" height="${it.height}"` : '';
  const hideSection = id => {
    $(`#${id}`)?.setAttribute('hidden', '');
    $$(`[data-s="${id}"], .menu a[href="#${id}"], .footer a[href="#${id}"]`).forEach(a => a.remove());
  };
  const ratioOf = it => it.width && it.height ? clamp(it.width / it.height, .5, 2.4) : null;

  /* ── Destacados ────────────────────────────────────────────── */
  /* Cada fila de 3: la pieza más angosta va al centro y las más anchas a los lados.
     Con orden manual (settings.featured.auto_center = false) se respeta el orden del panel. */
  function arrangeFeatured(items, auto) {
    if (!auto) return items;
    const out = [];
    for (let k = 0; k < items.length; k += 3) {
      const g = items.slice(k, k + 3);
      if (g.length < 3) { out.push(...g); continue; }
      const r = it => it.width && it.height ? it.width / it.height : 1;
      const mid = g.reduce((m, it, n) => r(it) < r(g[m]) ? n : m, 0);
      const rest = g.filter((_, n) => n !== mid);
      out.push(rest[0], g[mid], rest[1]);
    }
    return out;
  }

  function renderFeatured(items, auto = true) {
    if (!items.length) return hideSection('destacados');
    items = withAlt(items, 'Proyecto destacado');
    items = arrangeFeatured(items, auto);
    GROUPS.featured = items;
    const card = (it, i) => `
      <article class="feat-card" style="--ar:${(ratioOf(it) ? clamp(it.width / it.height, .6, 1.7) : 1).toFixed(4)}">
        <button class="feat-media" data-v="featured" data-i="${i}" aria-label="Ampliar ${esc(it.alt)}">
          <img src="${esc(it.src)}" alt="${esc(it.alt)}"${dims(it)} loading="${i ? 'lazy' : 'eager'}" decoding="async">
        </button>
        <div class="feat-text">
          ${it.title ? `<h3>${esc(it.title)}</h3>` : ''}
          ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
          ${it.tags?.length ? `<p class="feat-tags">${it.tags.map(t => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
        </div>
      </article>`;
    const rows = []; for (let k = 0; k < items.length; k += 3) rows.push(items.slice(k, k + 3).map((it, n) => card(it, k + n)).join(''));
    $('#featuredGrid').innerHTML = rows.map(r => `<div class="feat-row">${r}</div>`).join('');
  }

  /* ── Galería: filas justificadas que respetan cada proporción ─ */
  const KINDS = [['mockups', 'Mockups'], ['designs', 'Diseños'], ['illustrations', 'Ilustraciones']];
  const PAGE = 9;
  const gal = { all: [], filter: 'all', shown: PAGE, tiles: [], list: [] };

  function renderGallery(data) {
    const byKind = Object.fromEntries(KINDS.map(([k]) => [k, withAlt(data[k], KINDS.find(x => x[0] === k)[1].replace(/s$/, ''))]));
    gal.byKind = byKind;
    const total = KINDS.reduce((n, [k]) => n + byKind[k].length, 0);
    if (!total) return hideSection('galeria');
    const kinds = KINDS.filter(([k]) => byKind[k].length);
    $('#chips').innerHTML = [['all', 'Todo', total], ...kinds.map(([k, l]) => [k, l, byKind[k].length])]
      .map(([k, l, n], i) => `<button class="chip" role="tab" data-f="${k}" aria-selected="${i === 0}">${l} <small>${n}</small></button>`).join('');
    $('#chips').hidden = kinds.length < 2;
    $('#chips').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      $$('.chip').forEach(c => c.setAttribute('aria-selected', c === b));
      const box = $('#gallery'); box.classList.add('swap');
      setTimeout(() => { gal.filter = b.dataset.f; gal.shown = PAGE; build(); box.scrollLeft = 0; box.classList.remove('swap'); }, reduceMotion ? 0 : 220);
    });
    $('#galMore').addEventListener('click', () => { gal.shown = (gal.rendered || gal.shown) + PAGE; build(); });
    $('#galLess').addEventListener('click', () => {
      gal.shown = PAGE; build();
      $('#galeria').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    const st = [[data.featured.length, 'Proyectos destacados'], [data.logos.length, 'Logos'], [total, 'Piezas en la galería']].filter(x => x[0]);
    $('#aboutStats').innerHTML = st.map(([n, t]) => `<div><b>${n}</b><span>${t}</span></div>`).join('');
    let wasMob = isMob();
    new ResizeObserver(() => { const w = $('#gallery').clientWidth; if (w !== gal.w) { gal.w = w; if (wasMob !== isMob()) { wasMob = isMob(); build(); } else layout(); } }).observe($('#gallery'));
    build();
  }

  function pool() {
    if (gal.filter !== 'all') return gal.byKind[gal.filter];
    const lists = KINDS.map(([k]) => gal.byKind[k]).filter(l => l.length), out = [];       // intercala tipos
    for (let i = 0; out.length < lists.reduce((n, l) => n + l.length, 0); i++) lists.forEach(l => { if (l[i]) out.push(l[i]); });
    return out;
  }

  function build() {
    const list = pool(); gal.list = list; GROUPS.gallery = list;
    const part = list.slice(0, isMob() ? list.length : gal.shown + 8);   // margen para cerrar la última fila; en móvil van todas, en carrusel
    $('#galCount').textContent = `${list.length} ${list.length === 1 ? 'pieza' : 'piezas'}`;
    const old = new Map(gal.tiles.map(t => [t._it, t]));
    gal.tiles = part.map((it, i) => {
      let t = old.get(it);
      if (!t) {
        t = document.createElement('button');
        t.className = 'tile'; t.dataset.cursor = 'Ver'; t.setAttribute('aria-label', `Ampliar ${it.alt}`);
        t.innerHTML = `<img src="${esc(it.thumb || it.src)}" alt="" loading="lazy" decoding="async">${it.title || it.category ? `<span class="cap">${esc(it.title || it.category)}</span>` : ''}`;
        t._it = it; t._r = ratioOf(it) || 1.25; t._known = !!ratioOf(it);
        const img = t.firstChild, done = () => {
          if (!t._known && img.naturalWidth) { t._r = clamp(img.naturalWidth / img.naturalHeight, .5, 2.4); t._known = true; layoutSoon(); }
          t.classList.add('ok');
        };
        img.addEventListener('load', done); img.addEventListener('error', done);
        if (img.complete && img.naturalWidth) done();
      }
      t.dataset.v = 'gallery'; t.dataset.i = list.indexOf(it);
      return t;
    });
    layout();
  }

  const isMob = () => innerWidth <= 640;
  let lt = 0;
  const layoutSoon = () => { clearTimeout(lt); lt = setTimeout(layout, 80); };
  function layout() {
    const box = $('#gallery'), W = box.clientWidth; if (!W || !gal.tiles.length) { if (!gal.tiles.length) box.textContent = ''; return; }
    if (isMob()) {                                       // móvil: carrusel horizontal con imán
      box.classList.add('jcar'); box.textContent = '';
      const h = Math.round(Math.min(270, Math.max(220, innerHeight * .31)));   // misma altura para todas: sin huecos debajo
      gal.tiles.forEach(t => { t.style.width = `${Math.round(Math.min(t._r * h, W * .9))}px`; t.style.height = `${h}px`; box.appendChild(t); });
      gal.rendered = gal.tiles.length; $('#galMore').hidden = true; $('#galLess').hidden = true; return;
    }
    box.classList.remove('jcar');
    const gap = W <= 700 ? 8 : 12, H = W < 520 ? 170 : W < 820 ? 200 : W < 1180 ? 260 : 300;
    const frag = document.createDocumentFragment(); let row = [], sum = 0, rendered = 0;
    const flush = (full) => {
      if (!row.length) return;
      const gaps = gap * (row.length - 1);
      let h = (W - gaps) / sum;
      if (!full && h > H * 1.35) h = H;                  // la última fila no se estira
      const el = document.createElement('div'); el.className = 'jrow'; el.style.height = `${h}px`;
      let used = 0;
      row.forEach((t, i) => {
        const w = full && i === row.length - 1 ? W - gaps - used : Math.floor(t._r * h);
        used += w; t.style.width = `${w}px`; t.style.height = `${h}px`; el.appendChild(t);
      });
      frag.appendChild(el); rendered += row.length; row = []; sum = 0;
    };
    for (const t of gal.tiles) {
      row.push(t); sum += t._r;
      if (sum * H + gap * (row.length - 1) >= W) {
        const h = (W - gap * (row.length - 1)) / sum;
        if (h < H * .62 && row.length > 1) { const last = row.pop(); sum -= last._r; flush(true); row = [last]; sum = last._r; }
        else flush(true);
        if (!row.length && rendered >= gal.shown) break;   // fila completa y ya hay suficientes piezas
      }
    }
    flush(false);
    box.textContent = ''; box.appendChild(frag);
    gal.rendered = rendered;
    const total = gal.list.length;
    $('#galMore').hidden = rendered >= total;
    $('#galLess').hidden = total <= PAGE || gal.shown <= PAGE;
    if (!$('#galMore').hidden) $('#galMore').textContent = `Ver más piezas (${total - rendered})`;
  }

  /* ── Logos ─────────────────────────────────────────────────── */
  /* ¿El archivo es casi todo claro (ej. logo blanco)? Sirve para elegir un fondo oscuro automáticamente */
  const lightCache = new Map();
  function isLightImg(url) {
    if (!lightCache.has(url)) lightCache.set(url, new Promise(res => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 40;
          const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 40, 40);
          const d = g.getImageData(0, 0, 40, 40).data; let n = 0, sum = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { n++; sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; }
          res(n > 30 ? sum / n > 0.8 : null);
        } catch { res(null); }
      };
      im.onerror = () => res(null); im.src = url;
    }));
    return lightCache.get(url);
  }

  let LOGOS = [];
  function renderLogos(items) {
    if (!items.length) return hideSection('logos');
    LOGOS = items.map(l => ({ ...l, alt: l.title || 'Logo' }));
    $('#logosGrid').innerHTML = LOGOS.map((l, i) => {
      const n = l.variations.length;
      return `<article class="logo-card">
        <button class="logo-tile" data-logo="${i}" aria-label="Ver ${esc(l.title)}"><img src="${esc(l.src)}" alt="${esc(l.alt)}"${dims(l)} loading="lazy" decoding="async"></button>
        <div class="logo-meta">
          <h3>${esc(l.title)}</h3>
          ${l.desc ? `<p>${esc(l.desc)}</p>` : ''}
          ${n > 1 ? `<button class="pill" data-logo="${i}">${icon('grid')} ${n} variaciones</button>` : ''}
        </div></article>`;
    }).join('');
    $$('.logo-tile').forEach((t, i) => isLightImg(LOGOS[i].src).then(f => t.classList.toggle('on-dark', f === true)));
    setupLogoCarousel();
  }

  /* Carrusel estático de logos: flechas en escritorio (solo si hay más de los que caben) y arrastre con el dedo en móvil */
  function setupLogoCarousel() {
    const track = $('#logosGrid');
    let wrap = track.parentElement;
    if (!wrap.classList.contains('lc')) {
      wrap = document.createElement('div'); wrap.className = 'lc'; track.before(wrap); wrap.appendChild(track);
      wrap.insertAdjacentHTML('beforeend', `<button class="lc-btn prev" aria-label="Logos anteriores">${icon('left')}</button><button class="lc-btn next" aria-label="Logos siguientes">${icon('right')}</button>`);
      const step = dir => track.scrollBy({ left: dir * track.clientWidth * .9, behavior: reduceMotion ? 'auto' : 'smooth' });
      $('.lc-btn.prev', wrap).addEventListener('click', () => step(-1));
      $('.lc-btn.next', wrap).addEventListener('click', () => step(1));
      track.addEventListener('scroll', update, { passive: true });
      new ResizeObserver(update).observe(track);
    }
    function update() {
      const max = track.scrollWidth - track.clientWidth;
      wrap.classList.toggle('lc-more', max > 4);
      $('.lc-btn.prev', wrap).disabled = track.scrollLeft < 4;
      $('.lc-btn.next', wrap).disabled = track.scrollLeft > max - 4;
    }
    update();
  }

  const dlg = $('#logoDialog');
  const BG = { light: '#F4F2EE', dark: '#0A0A0C' };
  let curLogo = null;
  const bgMode = 'auto';
  const isLightVar = lbl => /blanc|white|claro|negativ/i.test(lbl);          // variante para fondos oscuros

  function paintVariations() {
    const l = curLogo; if (!l) return;
    const cards = l.cards;
    GROUPS.vars = cards.map(v => ({ src: v.src, title: `${l.title}, ${v.label}`, alt: `${l.title}, ${v.label}`, bg: modeOf(v) }));
    $('#variations').className = `variations bg-${bgMode}${cards.length === 1 ? ' one' : ''}`;
    $('#variations').innerHTML = cards.map((v, n) => `
      <figure class="v-card m-${modeOf(v)}">
        <button class="v-img" data-v="vars" data-i="${n}" aria-label="Ampliar ${esc(v.label)}"><img src="${esc(v.src)}" alt="${esc(l.title)}, ${esc(v.label)}" loading="lazy" decoding="async"></button>
        <figcaption>${esc(v.label)}</figcaption>
      </figure>`).join('');
  }
  const modeOf = v => bgMode === 'auto' ? ((v.light ?? isLightVar(v.label)) ? 'dark' : 'light') : bgMode;

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-logo]'); if (!b) return;
    const l = LOGOS[+b.dataset.logo]; if (!l) return;
    const cards = [{ label: 'Principal', src: l.src }];
    l.variations.forEach(v => { if (v.image_url !== l.src) cards.push({ label: v.label || 'Variación', src: v.image_url }); });
    curLogo = { ...l, cards };
    $('#logoDialogTitle').textContent = l.title; $('#logoDialogDesc').textContent = l.desc || `${cards.length} ${cards.length === 1 ? 'versión' : 'versiones'}`;
    Promise.all(cards.map(c => isLightImg(c.src).then(f => { c.light = f; }))).then(() => { if (curLogo?.cards === cards || curLogo) paintVariations(); });
    paintVariations(); dlg.showModal();
  });
  $('#logoDialogClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  // El visor se abre por encima: se cierra el diálogo antes y se vuelve a abrir al cerrar el visor
  document.addEventListener('click', e => { if (e.target.closest('#variations [data-v]') && dlg.open) { V.reopen = dlg; dlg.close(); } }, true);

  /* ── Guías: páginas WebP bajo demanda ──────────────────────── */
  const pagesCache = new Map();
  function getPages(doc) {
    if (!pagesCache.has(doc.id)) pagesCache.set(doc.id, safe(rest(`pdf_pages?select=page_number,image_url,thumb_url,width,height&document_id=eq.${encodeURIComponent(doc.id)}&order=page_number.asc`), []));
    return pagesCache.get(doc.id);
  }

  function renderGuides(docs) {
    const sec = $('#guias');
    if (!docs.length) return hideSection('guias');
    sec.hidden = false;
    const meta = d => [d.page_count ? `${d.page_count} páginas` : 'PDF', d.client, d.year].filter(Boolean).join(' · ');
    $('#guides').innerHTML = `
      ${docs.length > 1 ? `<div class="g-list" role="tablist" aria-label="Guías disponibles">
        ${docs.map((d, i) => `<button class="g-tab" role="tab" aria-selected="${i === 0}" data-doc="${i}">
          <span class="g-cover">${d.cover_url ? `<img src="${esc(d.cover_url)}" alt="" loading="lazy" decoding="async">` : icon('grid')}</span>
          <span class="g-text"><strong>${esc(d.title)}</strong><small>${esc(meta(d))}</small></span></button>`).join('')}
      </div>` : ''}
      <div class="g-stage" id="gStage" aria-live="polite"></div>`;
    const tabs = $$('.g-tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', x === t));
      openDoc(docs[+t.dataset.doc]);
    }));
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); openDoc(docs[0]); } }, { rootMargin: '300px' });
    io.observe(sec);
  }

  /* Lector de guías: el marco mide lo que mide la pantalla, así la página siempre se ve completa */
  async function openDoc(doc) {
    const stage = $('#gStage'), token = (stage._t = (stage._t || 0) + 1);
    const meta = [doc.page_count ? `${doc.page_count} páginas` : 'PDF', doc.client, doc.year].filter(Boolean).join(' · ');
    const link = doc.source_url ? `<a class="btn btn-line btn-sm" href="${esc(doc.source_url)}" target="_blank" rel="noopener">${icon('external')} Abrir PDF</a>` : '';
    if (!doc.page_count) { stage.innerHTML = `<div class="gv-empty"><h3>${esc(doc.title)}</h3><p>Esta guía está disponible como archivo PDF.</p>${link}</div>`; return; }

    stage.innerHTML = '<div class="gv skeleton" aria-hidden="true"></div>';
    const pages = await getPages(doc);
    if (token !== stage._t) return;                       // cambió de guía mientras cargaba
    if (!pages.length) { stage.innerHTML = `<div class="gv-empty"><h3>${esc(doc.title)}</h3><p>No se pudieron cargar las páginas. Inténtalo de nuevo en un momento.</p>${link}</div>`; return; }

    const key = `doc-${doc.id}`, n = pages.length;
    GROUPS[key] = pages.map((p, i) => ({ src: p.image_url, thumb: p.thumb_url, title: doc.title, desc: `Página ${i + 1} de ${n}`, alt: `${doc.title}, página ${i + 1}` }));
    stage.innerHTML = `
      <div class="gv" tabindex="0" aria-label="${esc(doc.title)}. Usa las flechas del teclado para cambiar de página.">
        <div class="gv-info">
          <h3>${esc(doc.title)}</h3>
          <div class="gv-meta">${[doc.page_count + ' páginas', doc.client, doc.year].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
          ${doc.description ? `<p class="gv-desc" id="rdDesc">${esc(doc.description)}</p><button class="gv-more" id="rdMore" hidden>Leer más</button>` : ''}
          <div class="gv-pos" aria-hidden="true"><div class="gv-big"><b id="rdPos">1</b><span>/ ${n}</span></div><i><u id="rdBar"></u></i></div>
          <div class="gv-keys" aria-hidden="true"><span><kbd>←</kbd><kbd>→</kbd> cambiar de página</span><span><kbd>clic</kbd> ampliar</span></div>
          ${link}
        </div>
        <div class="gv-main">
          <button class="gv-nav prev" id="rdPrev" aria-label="Página anterior">${icon('left')}</button>
          <div class="gv-frame"><button class="gv-page" id="rdPage" data-v="${esc(key)}" data-i="0" data-cursor="Ver" aria-label="Ampliar la página"><img id="rdImg" alt="" decoding="async"></button>
            <button class="gv-ic" id="rdOpen" data-v="${esc(key)}" data-i="0" aria-label="Ampliar con zoom" data-tip="Ampliar">${icon('zoom')}</button></div>
          <button class="gv-nav next" id="rdNext" aria-label="Página siguiente">${icon('right')}</button>
        </div>
      </div>`;

    const p0 = pages[0]; if (p0?.width && p0?.height) stage.querySelector('.gv').style.setProperty('--ar', (p0.width / p0.height).toFixed(4));
    const dsc = $('#rdDesc'), mor = $('#rdMore');                 // descripción larga: se recorta y se puede abrir
    if (dsc && mor) { requestAnimationFrame(() => { if (dsc.scrollHeight > dsc.clientHeight + 2) mor.hidden = false; }); mor.addEventListener('click', () => { const o = dsc.classList.toggle('open'); mor.textContent = o ? 'Leer menos' : 'Leer más'; }); }
    const gv = $('.gv', stage), img = $('#rdImg'), pg = $('#rdPage');
    let cur = -1, swiped = false;
    const show = (k, first) => {
      k = clamp(k, 0, n - 1); if (k === cur) return; cur = k;
      const p = pages[k];
      pg.dataset.i = k; $('#rdOpen').dataset.i = k;
      $('#rdPos').textContent = k + 1; $('#rdBar').style.width = `${((k + 1) / n) * 100}%`;
      $('#rdPrev').disabled = k === 0; $('#rdNext').disabled = k === n - 1;
      img.alt = `${doc.title}, página ${k + 1}`;
      const full = new Image();                           // la página se muestra en alta calidad cuando termina de cargar
      full.onload = () => { if (cur === k) { img.src = p.image_url; img.classList.remove('swap'); void img.offsetWidth; img.classList.add('swap'); } };
      full.src = p.image_url;
      if (first) img.src = p.thumb_url || p.image_url;
      if (pages[k + 1]) new Image().src = pages[k + 1].image_url;
    };
    show(0, true);
    $('#rdPrev').addEventListener('click', () => show(cur - 1));
    $('#rdNext').addEventListener('click', () => show(cur + 1));
    gv.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); } });
    let x0 = null;                                        // deslizar con el dedo para cambiar de página
    pg.addEventListener('pointerdown', e => { x0 = e.clientX; swiped = false; });
    pg.addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) { swiped = true; show(cur + (e.clientX < x0 ? 1 : -1)); } x0 = null; });
    pg.addEventListener('click', e => { if (swiped) { e.stopImmediatePropagation(); e.preventDefault(); swiped = false; } }, true);
  }

  /* ── Recordar dónde estabas al recargar ──────────────────────── */
  const pos = { track: false };
  function restorePosition() {
    const id = decodeURIComponent(location.hash.slice(1));
    const t = id && document.getElementById(id);
    if (!t || t.hidden) { pos.track = true; return; }
    let stop = false; const cancel = () => { stop = true; };
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => addEventListener(ev, cancel, { once: true, passive: true }));
    const go = () => { if (!stop) scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + scrollY - 80), behavior: 'instant' }); };
    go();                                                  // el contenido sigue cargando: se reajusta hasta que todo se asienta
    addEventListener('load', go, { once: true });
    [300, 800, 1600].forEach(ms => setTimeout(go, ms));
    setTimeout(() => { pos.track = true; }, 1800);
  }

  /* ── Navegación, tema y scroll ─────────────────────────────── */
  function setupUI() {
    try { history.scrollRestoration = 'manual'; } catch { /* navegador antiguo */ }
    $('#year').textContent = new Date().getFullYear();
    const root = document.documentElement, meta = $('meta[name="theme-color"]');

    const setTheme = (t, x, y) => {
      const apply = () => { root.setAttribute('data-theme', t); store.set('ag_theme', t); meta?.setAttribute('content', t === 'dark' ? '#070608' : '#FAF9F7'); };
      if (reduceMotion) return apply();
      if (document.startViewTransition && CSS.supports?.('mask-image', 'radial-gradient(circle at 10px 10px,#000,transparent)')) {
        const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 160;
        root.style.setProperty('--vx', `${x}px`); root.style.setProperty('--vy', `${y}px`);
        const vt = document.startViewTransition(apply);                 // gota que se expande con borde difuso
        vt.ready.then(() => root.animate({ '--vr': ['0px', `${r}px`] },
          { duration: 1150, easing: 'cubic-bezier(.45,.05,.25,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
        vt.finished.catch(() => {});
      } else {
        root.classList.add('theme-fade'); apply();
        setTimeout(() => root.classList.remove('theme-fade'), 800);
      }
    };
    $('#themeToggle').addEventListener('click', e => {
      const b = e.currentTarget.getBoundingClientRect();
      setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', b.left + b.width / 2, b.top + b.height / 2);
    });

    const burger = $('#burger'), menu = $('#menu');
    const setMenu = open => { menu.hidden = !open; burger.setAttribute('aria-expanded', open); burger.classList.toggle('open', open); document.body.classList.toggle('no-scroll', open); };
    burger.addEventListener('click', () => setMenu(menu.hidden));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
    matchMedia('(min-width:1040px)').addEventListener('change', e => { if (e.matches && !menu.hidden) setMenu(false); });

    const bar = $('#progress'), nav = $('#nav'); let tick = false, last = scrollY;
    const onScroll = () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
        nav.classList.toggle('scrolled', y > 24);
        const dy = y - last;                                   // la barra se esconde al bajar y reaparece al subir
        if (document.body.classList.contains('no-scroll') || y < 120 || dy < -6) nav.classList.remove('hide');
        else if (dy > 6) nav.classList.add('hide');
        if (Math.abs(dy) > 6 || y < 120) last = y;
        tick = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    const TINT = { inicio: 'a', destacados: 'b', galeria: 'c', logos: 'd', guias: 'e', 'sobre-mi': 'f', contacto: 'g' };
    const links = $$('#navLinks a');
    const spy = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(a => a.classList.toggle('active', a.dataset.s === en.target.id));
      root.dataset.tint = TINT[en.target.id] || 'a';          // el fondo cambia de tonos al avanzar
      if (pos.track) { try { history.replaceState(null, '', en.target.id === 'inicio' ? location.pathname + location.search : '#' + en.target.id); } catch { /* sin historial */ } }
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').forEach(s => spy.observe(s));

  }

  /* ── Contacto ──────────────────────────────────────────────── */
  function setupContact(contact = {}) {
    const wa = String(contact.whatsapp || '51977575523').replace(/\D/g, '');
    const fmt = wa.startsWith('51') && wa.length === 11 ? `+51 ${wa.slice(2, 5)} ${wa.slice(5, 8)} ${wa.slice(8)}` : `+${wa}`;
    $('#cWhats').href = `https://wa.me/${wa}`; $('#cWhats').textContent = fmt;
    $('#cWhatsBtn').href = `https://wa.me/${wa}?text=${encodeURIComponent('Hola Ana Lucía, me interesa trabajar contigo')}`;
    $('#fWa').href = `https://wa.me/${wa}`; $('#fWaT').href = `https://wa.me/${wa}`; $('#fWaT span').textContent = fmt;
    if (contact.email) { $('#fMail').href = `mailto:${contact.email}`; $('#fMailT').href = `mailto:${contact.email}`; $('#fMailT span').textContent = contact.email; }
    if (contact.email) { $('#cEmail').href = `mailto:${contact.email}`; $('#cEmail').textContent = contact.email; }
    if (contact.instagram) {
      const u = String(contact.instagram).replace(/^@/, '').replace(/[^\w.]/g, '');
      if (u) $('.footer-social').insertAdjacentHTML('beforeend', `<a class="icon-btn" href="https://instagram.com/${u}" target="_blank" rel="noopener" aria-label="Instagram">${icon('insta')}</a>`);
      if (u) $('.contact-list').insertAdjacentHTML('beforeend', `<li><span class="ico">${icon('insta')}</span><span class="way"><small>Instagram</small><a href="https://instagram.com/${u}" target="_blank" rel="noopener">@${u}</a></span></li>`);
    }
    $('#contactForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = id => $(id).value.trim(), msg = $('#formMsg');
      if (!v('#fName') || !/^\S+@\S+\.\S+$/.test(v('#fEmail')) || !v('#fService') || !v('#fMessage')) {
        msg.textContent = 'Completa tu nombre, un email válido, el tipo de proyecto y tu mensaje.'; msg.className = 'form-msg err'; return;
      }
      const text = `Hola Ana Lucía, soy ${v('#fName')} (${v('#fEmail')}).\nProyecto: ${v('#fService')}\n\n${v('#fMessage')}`;
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      msg.textContent = 'Se abrió WhatsApp con tu mensaje listo para enviar.'; msg.className = 'form-msg ok';
      e.target.reset();
    });
  }

  /* ── Desplegables con estilo propio (cualquier <select>) ───── */
  function enhanceSelects(scope = document) {
    $$('select:not([data-enhanced])', scope).forEach(sel => {
      sel.dataset.enhanced = '1';
      const wrap = document.createElement('div'); wrap.className = 'sel';
      sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
      sel.classList.add('sel-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sel-btn';
      btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
      const list = document.createElement('ul'); list.className = 'sel-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
      wrap.append(btn, list);
      let active = -1;
      const opts = [...sel.options];
      list.innerHTML = opts.map((o, i) => `<li role="option" data-i="${i}"${o.value === '' ? ' class="ph"' : ''}>${esc(o.textContent)}</li>`).join('');
      const items = $$('li', list);
      const sync = () => {
        const o = sel.options[sel.selectedIndex];
        btn.innerHTML = `<span class="${sel.value === '' ? 'ph' : ''}">${esc(o ? o.textContent : '')}</span>${icon('down')}`;
        items.forEach((li, i) => li.setAttribute('aria-selected', i === sel.selectedIndex));
      };
      const mark = i => { active = clamp(i, 0, items.length - 1); items.forEach((li, k) => li.classList.toggle('on', k === active)); const li = items[active]; if (li) { if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 6; else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 6; } };
      const open = () => {
        wrap.classList.toggle('up', btn.getBoundingClientRect().bottom + 280 > innerHeight && btn.getBoundingClientRect().top > 300);
        list.hidden = false; btn.setAttribute('aria-expanded', 'true'); wrap.classList.add('open'); mark(Math.max(0, sel.selectedIndex));
      };
      const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); wrap.classList.remove('open'); };
      const pick = i => { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); sync(); close(); btn.focus(); };
      btn.addEventListener('click', () => list.hidden ? open() : close());
      list.addEventListener('click', e => { const li = e.target.closest('li'); if (li) pick(+li.dataset.i); });
      btn.addEventListener('keydown', e => {
        if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } return; }
        if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(e.key)) e.preventDefault(); else return;
        if (list.hidden) return open();
        if (e.key === 'ArrowDown') mark(active + 1); else if (e.key === 'ArrowUp') mark(active - 1);
        else if (e.key === 'Home') mark(0); else if (e.key === 'End') mark(items.length - 1);
        else pick(active);
      });
      document.addEventListener('pointerdown', e => { if (!wrap.contains(e.target)) close(); });
      sel.addEventListener('focus', () => btn.focus());
      sel.form?.addEventListener('reset', () => setTimeout(sync));
      sync();
    });
  }

  /* ── Textos editables desde el panel (site_settings) ────────── */
  const TOOL_PRESETS = { ps: ['Ps', '#001E36', '#31A8FF'], ai: ['Ai', '#330000', '#FF9A00'], ae: ['Ae', '#00005B', '#D291FF'], id: ['Id', '#49021F', '#FF3366'] };
  const toolBadge = t => {
    const p = TOOL_PRESETS[String(t.preset || '').toLowerCase()];
    const abbr = esc(String(t.abbr || p?.[0] || String(t.name || '?').slice(0, 2)).slice(0, 2));
    const bg = okColor(t.bg) || p?.[1] || '#2A1B4D', fg = okColor(t.fg) || p?.[2] || '#C4B5FD';
    return `<svg class="ti" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="7" fill="${bg}"/><text x="14" y="19.2" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="13" fill="${fg}">${abbr}</text></svg>`;
  };
  const ICONS = new Set(['ads', 'pen', 'mock', 'shapes', 'grid', 'mail', 'chat', 'pin', 'insta', 'plus']);
  function applyContent(st) {
    if (st.hero?.lead) $('.hero-lead').textContent = String(st.hero.lead).slice(0, 220);
    const a = st.about; if (!a) return;
    if (a.title) $('.about-main h2').textContent = String(a.title).slice(0, 60);
    if (a.lead) $('.about-lead').textContent = String(a.lead).slice(0, 700);
    if (a.show_facts === false) $('#aboutStats').hidden = true;
    if (a.areas_title) $$('.panel h3')[0].textContent = String(a.areas_title).slice(0, 60);
    if (a.tools_title) $$('.panel h3')[1].textContent = String(a.tools_title).slice(0, 60);
    if (Array.isArray(a.areas) && a.areas.length)
      $('.areas').innerHTML = a.areas.slice(0, 8).map(x => `<li><span class="ico">${icon(ICONS.has(x.icon) ? x.icon : 'shapes')}</span><div><strong>${esc(x.title)}</strong>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</div></li>`).join('');
    if (Array.isArray(a.tools) && a.tools.length)
      $('.tools').innerHTML = a.tools.slice(0, 12).map(t => `<li>${toolBadge(t)}${esc(t.name)}</li>`).join('');
  }

  /* ── Arranque ──────────────────────────────────────────────── */
  async function init() {
    setupUI();
    const { data, docs, settings } = await loadAll();
    applyTheme(settings.theme); applyContent(settings); enhanceSelects();

    const off = new Set();
    (Array.isArray(settings.sections) ? settings.sections : []).forEach(s => {
      const a = $(`[data-s="${s.id}"]`); if (a && s.label) a.textContent = s.label;
      if (s.visible === false) { off.add(s.id); hideSection(s.id); }
    });
    const run = (id, fn) => { if (!off.has(id)) fn(); };

    run('destacados', () => renderFeatured(data.featured, settings.featured?.auto_center !== false));
    run('galeria', () => renderGallery(data));
    run('logos', () => renderLogos(data.logos));
    run('guias', () => renderGuides(docs));
    setupContact(settings.contact);
    restorePosition();
  }
  init();
})();
