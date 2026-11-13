/* ============================================================
   Portfolio Ana Lucía García — v2
   - Contenido local (data/local-content.json) + Supabase (tablas works, pdf_*, site_settings)
   - Lectura pública por REST (sin librerías); la escritura vive en admin.html
   ============================================================ */
(() => {
  'use strict';

  const CFG = window.PORTFOLIO_CONFIG || {};
  const HAS_SB = !!CFG.SUPABASE_URL && !!CFG.SUPABASE_ANON &&
                 !CFG.SUPABASE_URL.includes('TU_PROYECTO') && !CFG.SUPABASE_ANON.includes('TU_ANON');

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        it.variations = assets.filter(a => a.work_id === w.id)
          .map(a => ({ label: a.label, image_url: a.image_url }));
      }
      data[k].push(it);
    }
    const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]));
    return { data, docs: docs.filter(d => d.page_count > 0 || d.source_url), settings: cfg };
  }

  /* ── Tema (colores, tipografía, secciones) desde site_settings ─ */
  const okColor = v => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v.trim()) ? v.trim() : null;
  const okFont  = v => typeof v === 'string' && /^[\w\s-]{2,40}$/.test(v.trim()) ? v.trim() : null;

  function applyTheme(theme) {
    if (!theme) return;
    const c = theme.colors || {}, d = c.dark || {};
    const pick = (obj, map) => Object.entries(map).map(([k, css]) => okColor(obj[k]) ? `${css}:${okColor(obj[k])};` : '').join('');
    const light = pick(c, { accent: '--accent', accentLight: '--accent-2', bg: '--bg', bgCard: '--card', bgSoft: '--soft', text: '--text', text2: '--text-2' });
    const dark  = pick(d, { bg: '--bg', bgCard: '--card', bgSoft: '--soft', text: '--text', text2: '--text-2' });
    const radius = { sharp: '4px', soft: '18px', round: '30px' }[theme.radius];
    const fd = okFont(theme.fonts?.display), fb = okFont(theme.fonts?.body);
    let css = `:root{${light}${radius ? `--r:${radius};` : ''}${fd ? `--f-display:'${fd}',Georgia,serif;` : ''}${fb ? `--f-body:'${fb}',system-ui,sans-serif;` : ''}}`;
    if (dark) css += `[data-theme="dark"]{${dark}}`;
    for (const [id, o] of Object.entries(theme.sections || {})) {
      if (!/^[\w-]+$/.test(id)) continue;
      const rule = (okColor(o.bg) ? `--sec-bg:${okColor(o.bg)};` : '') + (okColor(o.text) ? `--sec-text:${okColor(o.text)};` : '') + (okColor(o.accent) ? `--accent:${okColor(o.accent)};` : '');
      if (rule) css += `[data-theme-section="${id}"]{${rule}}`;
    }
    let el = $('#themeVars'); if (!el) { el = document.createElement('style'); el.id = 'themeVars'; document.head.appendChild(el); }
    el.textContent = css;
    const fams = [];
    if (fd && fd !== 'Playfair Display') fams.push(`family=${encodeURIComponent(fd).replace(/%20/g, '+')}:wght@400;600;700`);
    if (fb && fb !== 'Inter') fams.push(`family=${encodeURIComponent(fb).replace(/%20/g, '+')}:wght@300;400;500;600`);
    if (fams.length) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`; document.head.appendChild(l); }
  }

  /* ── Visor de imágenes (lightbox) ──────────────────────────── */
  const lb = {
    el: $('#lightbox'), img: $('#lbImg'), items: [], i: 0, opener: null,
    open(items, i, opener) {
      this.items = items; this.i = i; this.opener = opener || document.activeElement;
      this.el.hidden = false; document.body.classList.add('no-scroll');
      this.show(); $('#lbClose').focus();
    },
    show() {
      const it = this.items[this.i]; if (!it) return;
      this.img.classList.add('swap');
      const next = new Image();
      next.onload = next.onerror = () => { this.img.src = it.src; this.img.alt = it.alt || it.title || ''; this.img.classList.remove('swap'); };
      next.src = it.src;
      $('#lbTitle').textContent = it.title || '';
      $('#lbDesc').textContent = it.desc || it.category || '';
      $('#lbCount').textContent = this.items.length > 1 ? `${this.i + 1} / ${this.items.length}` : '';
      const multi = this.items.length > 1;
      $('#lbPrev').hidden = $('#lbNext').hidden = !multi;
      [-1, 1].forEach(d => { const n = this.items[(this.i + d + this.items.length) % this.items.length]; if (n) new Image().src = n.src; });
    },
    go(d) { if (this.items.length < 2) return; this.i = (this.i + d + this.items.length) % this.items.length; this.show(); },
    close() { this.el.hidden = true; document.body.classList.remove('no-scroll'); this.opener?.focus?.(); },
  };
  $('#lbClose').addEventListener('click', () => lb.close());
  $('#lbPrev').addEventListener('click', () => lb.go(-1));
  $('#lbNext').addEventListener('click', () => lb.go(1));
  lb.el.addEventListener('click', e => { if (e.target === lb.el || e.target.classList.contains('lb-fig')) lb.close(); });
  document.addEventListener('keydown', e => {
    if (lb.el.hidden) return;
    if (e.key === 'Escape') lb.close();
    else if (e.key === 'ArrowLeft') lb.go(-1);
    else if (e.key === 'ArrowRight') lb.go(1);
  });
  swipe(lb.el, d => lb.go(d));

  function swipe(el, cb) {
    let x0 = null, y0 = null;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) cb(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  /* ── Helpers de render ─────────────────────────────────────── */
  const imgTag = (it, alt, { full = false, cls = '' } = {}) =>
    `<img src="${esc(full ? it.src : (it.thumb || it.src))}" alt="${esc(alt)}"${it.width && it.height ? ` width="${it.width}" height="${it.height}"` : ''} loading="lazy" decoding="async"${cls ? ` class="${cls}"` : ''}>`;
  const withAlt = (items, label) => items.map((it, n) => ({ ...it, alt: it.title || `${label} ${n + 1}` }));
  const hideSection = id => { $(`#${id}`)?.setAttribute('hidden', ''); $$(`[data-s="${id}"], .mobile-menu a[href="#${id}"], .footer a[href="#${id}"]`).forEach(a => a.remove()); };
  const ICON_ZOOM = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2z"/></svg>';

  const GROUPS = {};   // grupo → items (para el lightbox)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lb]'); if (!b) return;
    lb.open(GROUPS[b.dataset.lb] || [], +b.dataset.i || 0, b);
  });

  /* ── Secciones ─────────────────────────────────────────────── */
  function renderFeatured(items) {
    const box = $('#featuredGrid');
    if (!items.length) return hideSection('destacados');
    items = withAlt(items, 'Proyecto destacado'); GROUPS.featured = items;
    box.innerHTML = items.map((it, i) => `
      <article class="b-item reveal">
        <button class="b-btn" data-lb="featured" data-i="${i}" aria-label="Ver ${esc(it.alt)}">
          ${imgTag(it, it.alt)}
          <span class="b-info">
            ${it.title ? `<h3>${esc(it.title)}</h3>` : ''}
            ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
            ${it.tags?.length ? `<span class="tags">${it.tags.map(t => `<span>${esc(t)}</span>`).join('')}</span>` : ''}
          </span>
        </button>
      </article>`).join('');
  }

  const MORE_LIMIT = { mockups: 6, designs: 9 };
  function renderMockups(items) {
    const box = $('#mockupsGrid');
    if (!items.length) return hideSection('mockups');
    items = withAlt(items, 'Mockup'); GROUPS.mockups = items;
    box.innerHTML = items.map((it, i) => `
      <figure class="m-card reveal"${i >= MORE_LIMIT.mockups ? ' data-extra' : ''}>
        <button class="m-btn" data-lb="mockups" data-i="${i}" aria-label="Ampliar ${esc(it.alt)}">
          ${imgTag(it, it.alt)}<span class="zoom">${ICON_ZOOM}</span>
        </button>
        ${(it.title || it.category) ? `<figcaption>${esc(it.title || it.category)}</figcaption>` : ''}
      </figure>`).join('');
    wireMore(box, $('#mockupsMore'), items.length, MORE_LIMIT.mockups);
  }

  function renderDesigns(items) {
    const box = $('#designsGrid');
    if (!items.length) return hideSection('disenos');
    items = withAlt(items, 'Diseño'); GROUPS.designs = items;
    box.classList.add('collapsed');
    box.innerHTML = items.map((it, i) => `
      <button class="d-card reveal" data-lb="designs" data-i="${i}"${i >= MORE_LIMIT.designs ? ' data-extra' : ''} aria-label="Ampliar ${esc(it.alt)}">
        ${imgTag(it, it.alt)}
        ${it.title ? `<span class="d-cap">${esc(it.title)}</span>` : ''}
      </button>`).join('');
    wireMore(box, $('#designsMore'), items.length, MORE_LIMIT.designs);
  }

  function wireMore(box, btn, total, limit) {
    if (!btn || total <= limit) return;
    btn.hidden = false;
    const label = () => box.classList.contains('collapsed') ? `Ver más (${total - limit})` : 'Ver menos';
    btn.textContent = label();
    btn.onclick = () => {
      box.classList.toggle('collapsed'); btn.textContent = label();
      if (box.classList.contains('collapsed')) box.closest('section').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      observeReveals();
    };
  }

  let LOGOS = [];
  function renderLogos(items) {
    const box = $('#logosGrid');
    if (!items.length) return hideSection('logos');
    LOGOS = items.map(l => ({ ...l, alt: l.title || 'Logo' }));
    box.innerHTML = LOGOS.map((l, i) => {
      const n = l.variations.length;
      return `
      <article class="l-card reveal">
        <button class="l-tile" data-logo="${i}" aria-label="Ver ${esc(l.title)}">${imgTag(l, l.alt, { full: true })}</button>
        <div class="l-meta">
          <h3>${esc(l.title)}</h3>
          ${l.desc ? `<p>${esc(l.desc)}</p>` : ''}
          ${n > 1 ? `<button class="link" data-logo="${i}">${n} variaciones <span aria-hidden="true">→</span></button>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  const dlg = $('#logoDialog');
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-logo]'); if (!b) return;
    const l = LOGOS[+b.dataset.logo]; if (!l) return;
    if (l.variations.length < 2) { GROUPS.logo1 = [{ ...l, src: l.src }]; return lb.open(GROUPS.logo1, 0, b); }
    $('#logoDialogTitle').textContent = l.title; $('#logoDialogDesc').textContent = l.desc;
    $('#variations').innerHTML = l.variations.map(v => `
      <figure class="v-card${/blanc|white|claro/i.test(v.label) ? ' on-dark' : ''}">
        <div class="v-img"><img src="${esc(v.image_url)}" alt="${esc(l.title)} — ${esc(v.label)}" loading="lazy" decoding="async"></div>
        <figcaption>${esc(v.label)}</figcaption>
      </figure>`).join('');
    dlg.showModal();
  });
  $('#logoDialogClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  function renderIllustrations(items) {
    const box = $('#illustrationsGrid');
    if (!items.length) return hideSection('ilustraciones');
    items = withAlt(items, 'Ilustración'); GROUPS.illus = items;
    box.innerHTML = items.map((it, i) => `
      <button class="i-card reveal" data-lb="illus" data-i="${i}" aria-label="Ampliar ${esc(it.alt)}">
        <img class="i-bg" src="${esc(it.thumb || it.src)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
        ${imgTag(it, it.alt, { cls: 'i-fg' })}
        ${(it.title || it.category) ? `<span class="i-cap">${esc(it.title || it.category)}</span>` : ''}
      </button>`).join('');
  }

  function renderHeroCollage(data) {
    const pool = [...data.designs, ...data.featured, ...data.illustrations].filter(i => i.width && i.height);
    const by = f => pool.find(i => f(i.width / i.height));
    const picks = [by(r => r < .85), by(r => r >= .85 && r <= 1.15), by(r => r > 1.15)].filter(Boolean);
    while (picks.length < 3 && pool.length) { const p = pool[picks.length]; if (!p || picks.includes(p)) break; picks.push(p); }
    if (!picks.length) return $('#heroCollage').remove();
    $('#heroCollage').innerHTML = picks.slice(0, 3).map((it, i) =>
      `<div class="hc hc${i + 1}">${imgTag(it, '', { cls: '' }).replace('loading="lazy"', 'loading="eager"')}</div>`).join('');
  }

  /* ── Guías: visor por páginas (imágenes WebP, carga bajo demanda) ── */
  const pagesCache = new Map();
  async function getPages(doc) {
    if (pagesCache.has(doc.id)) return pagesCache.get(doc.id);
    const p = safe(rest(`pdf_pages?select=page_number,image_url,thumb_url,width,height&document_id=eq.${encodeURIComponent(doc.id)}&order=page_number.asc`), []);
    pagesCache.set(doc.id, p); return p;
  }

  function renderGuides(docs) {
    const sec = $('#guias');
    if (!docs.length) return hideSection('guias');
    sec.hidden = false;
    const box = $('#guides');
    const meta = d => [d.page_count ? `${d.page_count} páginas` : 'PDF', d.client, d.year].filter(Boolean).join(' · ');
    box.innerHTML = `
      <div class="guide-list" role="tablist" aria-label="Guías disponibles">
        ${docs.map((d, i) => `
          <button class="g-tab${i === 0 ? ' active' : ''}" role="tab" aria-selected="${i === 0}" data-doc="${i}">
            <span class="g-cover">${d.cover_url ? `<img src="${esc(d.cover_url)}" alt="" loading="lazy" decoding="async">` : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm4 18H6V4h7v5h5z"/></svg>'}</span>
            <span class="g-text"><strong>${esc(d.title)}</strong><small>${esc(meta(d))}</small></span>
          </button>`).join('')}
      </div>
      <div class="guide-stage" id="guideStage" aria-live="polite"></div>`;
    const tabs = $$('.g-tab', box);
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
      openDoc(docs[+t.dataset.doc]);
    }));
    // La primera guía se carga cuando la sección entra en pantalla (no antes)
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); openDoc(docs[0]); } }, { rootMargin: '300px' });
    io.observe(sec);
  }

  async function openDoc(doc) {
    const stage = $('#guideStage');
    const token = (stage._t = (stage._t || 0) + 1);
    const info = `
      <div class="stage-head">
        <div><h3>${esc(doc.title)}</h3>${doc.description ? `<p>${esc(doc.description)}</p>` : ''}</div>
        <div class="stage-actions">${doc.source_url ? `<a class="btn btn-ghost btn-sm" href="${esc(doc.source_url)}" target="_blank" rel="noopener">Abrir PDF</a>` : ''}</div>
      </div>`;
    if (!doc.page_count) {
      stage.innerHTML = info + `<p class="empty">Esta guía todavía se ve solo como archivo PDF. ${doc.source_url ? 'Usa “Abrir PDF”.' : ''}</p>`;
      return;
    }
    stage.innerHTML = info + '<div class="reader-skeleton" aria-hidden="true"></div>';
    const pages = await getPages(doc);
    if (token !== stage._t) return;                       // el usuario cambió de guía
    if (!pages.length) { stage.innerHTML = info + '<p class="empty">No se pudieron cargar las páginas. Intenta de nuevo en un momento.</p>'; return; }

    const first = pages[0], ar = first.width && first.height ? first.width / first.height : (doc.orientation === 'portrait' ? .75 : 1.6);
    let cur = 0;
    const items = pages.map((p, i) => ({ src: p.image_url, title: doc.title, desc: `Página ${i + 1} de ${pages.length}`, alt: `${doc.title} — página ${i + 1}` }));
    GROUPS[`doc-${doc.id}`] = items;

    stage.innerHTML = info + `
      <div class="reader" tabindex="0" aria-label="Visor de la guía, usa las flechas del teclado">
        <button class="r-nav r-prev icon-btn" aria-label="Página anterior"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.4 16.6 10.8 12l4.6-4.6L14 6l-6 6 6 6z"/></svg></button>
        <div class="r-frame" style="--ar:${ar.toFixed(4)}"><img class="r-img" alt="" decoding="async"></div>
        <button class="r-nav r-next icon-btn" aria-label="Página siguiente"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z"/></svg></button>
      </div>
      <div class="r-bar">
        <span class="r-count"></span>
        <button class="btn btn-ghost btn-sm r-full">Ampliar página</button>
      </div>
      <div class="thumbs" role="list">
        ${pages.map((p, i) => `<button class="th" role="listitem" data-p="${i}" aria-label="Ir a la página ${i + 1}"><img src="${esc(p.thumb_url || p.image_url)}" alt="" loading="lazy" decoding="async"><b>${i + 1}</b></button>`).join('')}
      </div>`;

    const img = $('.r-img', stage), count = $('.r-count', stage), ths = $$('.th', stage), reader = $('.reader', stage);
    const go = n => {
      cur = (n + pages.length) % pages.length;
      img.classList.add('swap');
      const pre = new Image();
      pre.onload = pre.onerror = () => { if (token !== stage._t) return; img.src = pages[cur].image_url; img.alt = items[cur].alt; img.classList.remove('swap'); };
      pre.src = pages[cur].image_url;
      count.textContent = `Página ${cur + 1} de ${pages.length}`;
      ths.forEach((t, i) => t.classList.toggle('on', i === cur));
      const th = ths[cur]; th.parentElement.scrollTo({ left: th.offsetLeft - th.parentElement.clientWidth / 2 + th.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      [cur + 1, cur - 1].forEach(k => { const q = pages[(k + pages.length) % pages.length]; if (q) new Image().src = q.image_url; });
    };
    $('.r-prev', stage).addEventListener('click', () => go(cur - 1));
    $('.r-next', stage).addEventListener('click', () => go(cur + 1));
    ths.forEach(t => t.addEventListener('click', () => go(+t.dataset.p)));
    $('.r-full', stage).addEventListener('click', e => lb.open(items, cur, e.currentTarget));
    img.addEventListener('click', () => lb.open(items, cur, img));
    reader.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); } });
    swipe(reader, d => go(cur + d));
    go(0);
  }

  /* ── Navegación, scroll y animaciones ──────────────────────── */
  function setupUI() {
    $('#year').textContent = new Date().getFullYear();

    const root = document.documentElement;
    $('#themeToggle').addEventListener('click', () => {
      const t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', t); store.set('ag_theme', t);
    });

    const burger = $('#burger'), menu = $('#mobileMenu');
    const setMenu = open => { menu.hidden = !open; burger.setAttribute('aria-expanded', open); burger.classList.toggle('open', open); document.body.classList.toggle('no-scroll', open); };
    burger.addEventListener('click', () => setMenu(menu.hidden));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

    const bar = $('#progress'), nav = $('#nav'); let tick = false;
    addEventListener('scroll', () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        const h = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
        nav.classList.toggle('scrolled', scrollY > 24); tick = false;
      });
    }, { passive: true });

    const links = $$('#navLinks a');
    const spy = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.dataset.s === en.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').forEach(s => spy.observe(s));
  }

  let revealIO;
  function observeReveals() {
    if (!revealIO) revealIO = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal:not(.in)').forEach(el => reduceMotion ? el.classList.add('in') : revealIO.observe(el));
  }

  function countUp(total) {
    $('#statProjects').dataset.count = total;
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      const to = +en.target.dataset.count || 0, t0 = performance.now(), dur = reduceMotion ? 1 : 1100;
      const step = t => { const p = Math.min(1, (t - t0) / dur); en.target.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }));
    $$('[data-count]').forEach(el => io.observe(el));
  }

  /* ── Contacto ──────────────────────────────────────────────── */
  function setupContact(contact = {}) {
    let wa = String(contact.whatsapp || '51977575523').replace(/\D/g, '');
    const fmt = wa.startsWith('51') && wa.length === 11 ? `+51 ${wa.slice(2, 5)} ${wa.slice(5, 8)} ${wa.slice(8)}` : `+${wa}`;
    $('#cWhats').href = `https://wa.me/${wa}`; $('#cWhats').textContent = fmt;
    $('#cWhatsBtn').href = `https://wa.me/${wa}?text=${encodeURIComponent('Hola Ana Lucía, me interesa trabajar contigo')}`;
    if (contact.email) { $('#cEmail').href = `mailto:${contact.email}`; $('#cEmail').textContent = contact.email; }
    if (contact.instagram) {
      const u = String(contact.instagram).replace(/^@/, '').replace(/[^\w.]/g, '');
      $('.contact-list').insertAdjacentHTML('beforeend', `<li><span class="ci"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.2-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg></span><div><small>Instagram</small><a href="https://instagram.com/${u}" target="_blank" rel="noopener">@${u}</a></div></li>`);
    }
    $('#contactForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = id => $(id).value.trim(), msg = $('#formMsg');
      if (!v('#fName') || !/^\S+@\S+\.\S+$/.test(v('#fEmail')) || !v('#fService') || !v('#fMessage')) {
        msg.textContent = 'Completa nombre, un email válido, el tipo de proyecto y tu mensaje.'; msg.className = 'form-msg err'; return;
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

    renderHeroCollage(data);
    run('destacados', () => renderFeatured(data.featured));
    run('mockups', () => renderMockups(data.mockups));
    run('disenos', () => renderDesigns(data.designs));
    run('logos', () => renderLogos(data.logos));
    run('ilustraciones', () => renderIllustrations(data.illustrations));
    run('guias', () => renderGuides(docs));
    setupContact(settings.contact);
    countUp(data.mockups.length + data.designs.length + data.logos.length + data.illustrations.length);
    observeReveals();
  }
  init();
})();
