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
    const data = {};
    for (const k of Object.keys(empty)) data[k] = (local[k] || []).map(norm);
    for (const w of works) {
      const k = kindMap[w.kind]; if (!k || !w.image_url) continue;
      const it = norm(w);
      if (k === 'logos') {
        it.title = w.title; it.desc = w.description || '';
        it.variations = assets.filter(a => a.work_id === w.id).map(a => ({ label: a.label, image_url: a.image_url }));
      }
      data[k].push(it);
    }
    const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]));
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
      const rule = (okColor(o.bg) ? `--sec-bg:${okColor(o.bg)};` : '') + (okColor(o.text) ? `--sec-text:${okColor(o.text)};` : '') + (okColor(o.accent) ? `--accent:${okColor(o.accent)};` : '');
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
  function renderFeatured(items) {
    if (!items.length) return hideSection('destacados');
    items = withAlt(items, 'Proyecto destacado'); GROUPS.featured = items;
    $('#featuredGrid').innerHTML = items.map((it, i) => `
      <article class="feat-card">
        <button class="feat-media" data-v="featured" data-i="${i}" aria-label="Ampliar ${esc(it.alt)}">
          <img class="bgi" src="${esc(it.thumb || it.src)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
          <img class="fg" src="${esc(it.src)}" alt="${esc(it.alt)}"${dims(it)} loading="${i ? 'lazy' : 'eager'}" decoding="async">
        </button>
        <div class="feat-text">
          ${it.title ? `<h3>${esc(it.title)}</h3>` : ''}
          ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
          ${it.tags?.length ? `<p class="feat-tags">${it.tags.map(t => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
        </div>
      </article>`).join('');
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
      setTimeout(() => { gal.filter = b.dataset.f; gal.shown = PAGE; build(); box.classList.remove('swap'); }, reduceMotion ? 0 : 220);
    });
    $('#galMore').addEventListener('click', () => { gal.shown = (gal.rendered || gal.shown) + PAGE; build(); });
    $('#galLess').addEventListener('click', () => {
      gal.shown = PAGE; build();
      $('#galeria').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    $('#aboutFacts').textContent = `${total + data.logos.length + data.featured.length} piezas publicadas entre proyectos destacados, mockups, diseños, logos e ilustraciones.`;
    new ResizeObserver(() => { const w = $('#gallery').clientWidth; if (w !== gal.w) { gal.w = w; layout(); } }).observe($('#gallery'));
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
    const part = list.slice(0, gal.shown + 8);   // margen para cerrar la última fila
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

  let lt = 0;
  const layoutSoon = () => { clearTimeout(lt); lt = setTimeout(layout, 80); };
  function layout() {
    const box = $('#gallery'), W = box.clientWidth; if (!W || !gal.tiles.length) { if (!gal.tiles.length) box.textContent = ''; return; }
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
  }

  const dlg = $('#logoDialog');
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-logo]'); if (!b) return;
    const l = LOGOS[+b.dataset.logo]; if (!l) return;
    if (l.variations.length < 2) { GROUPS.logo = [{ src: l.src, title: l.title, alt: l.alt }]; return V.open(GROUPS.logo, 0, b); }
    $('#logoDialogTitle').textContent = l.title; $('#logoDialogDesc').textContent = l.desc;
    GROUPS.vars = l.variations.map(v => ({ src: v.image_url, title: `${l.title}, ${v.label}`, alt: `${l.title}, ${v.label}` }));
    $('#variations').innerHTML = l.variations.map((v, n) => `
      <figure class="v-card${/blanc|white|claro|negativ/i.test(v.label) ? ' on-dark' : ''}">
        <button class="v-img" data-v="vars" data-i="${n}" aria-label="Ampliar ${esc(v.label)}"><img src="${esc(v.image_url)}" alt="${esc(l.title)}, ${esc(v.label)}" loading="lazy" decoding="async"></button>
        <figcaption>${esc(v.label)}</figcaption>
      </figure>`).join('');
    dlg.showModal();
  });
  $('#logoDialogClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  // El visor se abre sobre el diálogo (que está en la capa superior): lo cerramos antes
  document.addEventListener('click', e => { if (e.target.closest('#variations [data-v]') && dlg.open) dlg.close(); }, true);

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
    const meta = d => [d.page_count ? `${d.page_count} páginas` : 'PDF', d.client, d.year].filter(Boolean).join('  ');
    $('#guides').innerHTML = `
      <div class="g-list" role="tablist" aria-label="Guías disponibles">
        ${docs.map((d, i) => `<button class="g-tab" role="tab" aria-selected="${i === 0}" data-doc="${i}">
          <span class="g-cover">${d.cover_url ? `<img src="${esc(d.cover_url)}" alt="" loading="lazy" decoding="async">` : icon('grid')}</span>
          <span class="g-text"><strong>${esc(d.title)}</strong><small>${esc(meta(d))}</small></span></button>`).join('')}
      </div>
      <div class="g-stage" id="gStage" aria-live="polite"></div>`;
    const tabs = $$('.g-tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', x === t));
      openDoc(docs[+t.dataset.doc]);
    }));
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); openDoc(docs[0]); } }, { rootMargin: '300px' });
    io.observe(sec);
  }

  async function openDoc(doc) {
    const stage = $('#gStage'), token = (stage._t = (stage._t || 0) + 1);
    const facts = [doc.page_count ? `${doc.page_count} páginas` : '', doc.client, doc.year].filter(Boolean).map(f => `<span>${esc(f)}</span>`).join('');
    const head = (action = '') => `<div class="stage-head"><div><h3>${esc(doc.title)}</h3>${doc.description ? `<p>${esc(doc.description)}</p>` : ''}${facts ? `<div class="facts">${facts}</div>` : ''}</div>${action}</div>`;
    const link = doc.source_url ? `<a class="btn btn-line btn-sm" href="${esc(doc.source_url)}" target="_blank" rel="noopener">${icon('external')} Abrir PDF</a>` : '';
    if (!doc.page_count) { stage.innerHTML = head(link) + '<p class="empty">Esta guía está disponible como archivo PDF.</p>'; return; }

    stage.innerHTML = head() + `<div class="pages" aria-hidden="true">${'<div class="skeleton" style="width:200px"></div>'.repeat(4)}</div>`;
    const pages = await getPages(doc);
    if (token !== stage._t) return;                       // cambió de guía mientras cargaba
    if (!pages.length) { stage.innerHTML = head(link) + '<p class="empty">No se pudieron cargar las páginas. Inténtalo de nuevo en un momento.</p>'; return; }

    const items = pages.map((p, i) => ({ src: p.image_url, thumb: p.thumb_url, title: doc.title, desc: `Página ${i + 1} de ${pages.length}`, alt: `${doc.title}, página ${i + 1}` }));
    GROUPS[`doc-${doc.id}`] = items;
    const SHOW = 10, more = pages.length - SHOW;
    stage.innerHTML = head(`<button class="btn btn-sm" data-v="doc-${esc(doc.id)}" data-i="0">${icon('plus')} Abrir guía</button>`) + `
      <div class="pages">
        ${pages.slice(0, SHOW).map((p, i) => `<button class="pg" data-v="doc-${esc(doc.id)}" data-i="${i}" data-cursor="Ver" aria-label="Página ${i + 1}">
          <img src="${esc(p.thumb_url || p.image_url)}" alt=""${dims(p)} loading="lazy" decoding="async"><b>${i + 1}</b></button>`).join('')}
        ${more > 0 ? `<button class="pg pg-more" data-v="doc-${esc(doc.id)}" data-i="${SHOW}">+${more} páginas</button>` : ''}
      </div>`;
  }

  const TINT = { inicio: 'a', destacados: 'b', galeria: 'c', logos: 'd', guias: 'e', 'sobre-mi': 'f', contacto: 'g' };

  /* ── Navegación, tema y scroll ─────────────────────────────── */
  function setupUI() {
    $('#year').textContent = new Date().getFullYear();
    const root = document.documentElement, meta = $('meta[name="theme-color"]');

    const setTheme = t => {
      const apply = () => { root.setAttribute('data-theme', t); store.set('ag_theme', t); meta?.setAttribute('content', t === 'dark' ? '#070608' : '#FAF9F7'); };
      if (reduceMotion) return apply();
      if (document.startViewTransition) {                 // fundido cruzado suave
        const vt = document.startViewTransition(apply);
        vt.finished.catch(() => {});
      } else {
        root.classList.add('theme-fade'); apply();
        setTimeout(() => root.classList.remove('theme-fade'), 800);
      }
    };
    $('#themeToggle').addEventListener('click', () => setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

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
        last = y; tick = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    const links = $$('#navLinks a');
    const spy = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(a => a.classList.toggle('active', a.dataset.s === en.target.id));
      root.dataset.tint = TINT[en.target.id] || 'a';          // el fondo cambia de tonos al avanzar
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').forEach(s => spy.observe(s));

  }

  /* ── Contacto ──────────────────────────────────────────────── */
  function setupContact(contact = {}) {
    const wa = String(contact.whatsapp || '51977575523').replace(/\D/g, '');
    const fmt = wa.startsWith('51') && wa.length === 11 ? `+51 ${wa.slice(2, 5)} ${wa.slice(5, 8)} ${wa.slice(8)}` : `+${wa}`;
    $('#cWhats').href = `https://wa.me/${wa}`; $('#cWhats').textContent = fmt;
    $('#cWhatsBtn').href = `https://wa.me/${wa}?text=${encodeURIComponent('Hola Ana Lucía, me interesa trabajar contigo')}`;
    $('#fWa').href = `https://wa.me/${wa}`;
    if (contact.email) { $('#fMail').href = `mailto:${contact.email}`; }
    if (contact.email) { $('#cEmail').href = `mailto:${contact.email}`; $('#cEmail').textContent = contact.email; }
    if (contact.instagram) {
      const u = String(contact.instagram).replace(/^@/, '').replace(/[^\w.]/g, '');
      if (u) $('.contact-list').insertAdjacentHTML('beforeend', `<li>${icon('insta')}<a href="https://instagram.com/${u}" target="_blank" rel="noopener">@${u}</a></li>`);
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

  /* ── Arranque ──────────────────────────────────────────────── */
  async function init() {
    setupUI();
    const { data, docs, settings } = await loadAll();
    applyTheme(settings.theme);

    const off = new Set();
    (Array.isArray(settings.sections) ? settings.sections : []).forEach(s => {
      const a = $(`[data-s="${s.id}"]`); if (a && s.label) a.textContent = s.label;
      if (s.visible === false) { off.add(s.id); hideSection(s.id); }
    });
    const run = (id, fn) => { if (!off.has(id)) fn(); };

    run('destacados', () => renderFeatured(data.featured));
    run('galeria', () => renderGallery(data));
    run('logos', () => renderLogos(data.logos));
    run('guias', () => renderGuides(docs));
    setupContact(settings.contact);
  }
  init();
})();
