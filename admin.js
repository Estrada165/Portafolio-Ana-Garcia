/* ============================================================
   Panel de administración — Portafolio Ana García
   Supabase Auth + REST + Storage (cliente supabase-js).
   Imágenes: se optimizan a WebP en el navegador antes de subir.
   PDF: se convierten a páginas WebP con PDF.js (carga perezosa).
   ============================================================ */
(() => {
  'use strict';

  /* ── Utilidades ─────────────────────────────────────────── */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } } };

  const CFG = window.PORTFOLIO_CONFIG || {};
  const BUCKET = CFG.BUCKET || 'media';
  const HAS_SB = !!CFG.SUPABASE_URL && !!CFG.SUPABASE_ANON && !CFG.SUPABASE_URL.includes('TU_PROYECTO') && !CFG.SUPABASE_ANON.includes('TU_ANON') && !!window.supabase;

  const KINDS = [
    { id: 'featured',     label: 'Destacados',   lk: 'featured',      hint: 'Aparecen arriba, de a tres. Puedes darles título, descripción y etiquetas.' },
    { id: 'mockup',       label: 'Mockups',      lk: 'mockups',       hint: 'Presentaciones de marca y aplicaciones.' },
    { id: 'design',       label: 'Diseños',      lk: 'designs',       hint: 'Piezas de diseño gráfico y publicidad.' },
    { id: 'illustration', label: 'Ilustraciones', lk: 'illustrations', hint: 'Arte digital.' },
    { id: 'logo',         label: 'Logos',        lk: 'logos',         hint: 'Cada logo puede tener variaciones (versión blanca, negra, etc.).' },
  ];
  const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));
  const DEFAULT_CAT = { mockup: 'Presentación de Marca', design: 'Diseño Gráfico', illustration: 'Arte Digital', featured: '', logo: '' };
  const AREA_ICONS = [['ads', 'Publicidad'], ['pen', 'Pluma'], ['mock', 'Mockup'], ['shapes', 'Formas'], ['grid', 'Cuadrícula'], ['mail', 'Correo'], ['chat', 'Chat'], ['pin', 'Ubicación'], ['insta', 'Instagram'], ['plus', 'Más']];
  const FONTS_DISPLAY = ['Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Fraunces', 'Lora', 'Bricolage Grotesque', 'Space Grotesk', 'Syne', 'Poppins'];
  const FONTS_BODY = ['Inter', 'DM Sans', 'Manrope', 'Work Sans', 'Outfit', 'Nunito Sans', 'Source Sans 3', 'Lato'];
  const SECTION_IDS = [['inicio', 'Inicio'], ['sobre-mi', 'Sobre mí'], ['destacados', 'Destacados'], ['galeria', 'Galería'], ['logos', 'Logos'], ['guias', 'Guías'], ['contacto', 'Contacto']];

  const LIMITS = { img: 25 * 1024 * 1024, pdf: 80 * 1024 * 1024, pdfPages: 150 };

  const S = {
    user: null, works: [], assets: [], docs: [], settings: {}, local: {}, defaults: null,
    tagsOk: true, view: 'home', kind: 'featured', busy: false,
  };
  let sb = null;

  /* ── Avisos ──────────────────────────────────────────────── */
  function toast(msg, err) {
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; t.setAttribute('role', err ? 'alert' : 'status');
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), err ? 7000 : 3200);
  }
  const fail = (e, ctx) => { console.error(ctx || '', e); toast((ctx ? ctx + ': ' : '') + (e?.message || e), true); };

  function progress(text, pct) {
    const p = $('#progress');
    if (text == null) { p.hidden = true; return; }
    p.hidden = false;
    p.innerHTML = `<div>${esc(text)}</div><div class="bar"><i style="width:${Math.round((pct || 0) * 100)}%"></i></div>`;
  }

  /* ── Diálogo único ───────────────────────────────────────── */
  const dlg = $('#dlg');
  let dlgDone = null;
  function openDlg({ title, body, foot, wide }) {
    $('#dlgTitle').textContent = title;
    $('#dlgBody').innerHTML = ''; $('#dlgFoot').innerHTML = '';
    typeof body === 'string' ? ($('#dlgBody').innerHTML = body) : $('#dlgBody').appendChild(body);
    typeof foot === 'string' ? ($('#dlgFoot').innerHTML = foot) : foot && $('#dlgFoot').appendChild(foot);
    $('#dlgFoot').hidden = !foot;
    dlg.style.width = wide ? 'min(820px,94vw)' : '';
    if (!dlg.open) dlg.showModal();
    return new Promise(res => { dlgDone = res; });
  }
  function closeDlg(v) { if (dlg.open) dlg.close(); const d = dlgDone; dlgDone = null; d && d(v); }
  $('#dlgX').onclick = () => closeDlg(null);
  dlg.addEventListener('cancel', e => { e.preventDefault(); closeDlg(null); });
  dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(null); });

  function ask(title, text, ok = 'Aceptar', danger = false) {
    const foot = document.createElement('div'); foot.className = 'r'; foot.style.marginLeft = 'auto';
    foot.innerHTML = `<button class="btn" data-r="0">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button>`;
    foot.onclick = e => { const b = e.target.closest('[data-r]'); if (b) closeDlg(b.dataset.r === '1'); };
    return openDlg({ title, body: `<p>${esc(text)}</p>`, foot }).then(v => !!v);
  }

  /* ── Imágenes ────────────────────────────────────────────── */
  async function bitmapOf(blob) {
    if (blob.type === 'image/svg+xml' || !window.createImageBitmap) {
      const url = URL.createObjectURL(blob);
      try {
        const im = new Image(); im.src = url; await im.decode();
        return { src: im, w: im.naturalWidth || 1000, h: im.naturalHeight || 1000, close() {} };
      } finally { setTimeout(() => URL.revokeObjectURL(url), 4000); }
    }
    const bm = await createImageBitmap(blob);
    return { src: bm, w: bm.width, h: bm.height, close: () => bm.close && bm.close() };
  }
  const toBlob = (cv, type, q) => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('No se pudo convertir la imagen')), type, q));
  async function drawTo(bm, longEdge, type, q) {
    const k = Math.min(1, longEdge / Math.max(bm.w, bm.h));
    const w = Math.max(1, Math.round(bm.w * k)), h = Math.max(1, Math.round(bm.h * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(bm.src, 0, 0, w, h);
    return { blob: await toBlob(cv, type, q), w, h };
  }
  /* Devuelve { full, thumb, w, h } — full ≤ 2400 px, thumb ≤ 640 px, ambos WebP */
  async function processImage(blob, opt = {}) {
    if (!/^image\/(jpeg|png|webp|gif|svg\+xml|avif)$/.test(blob.type)) throw new Error('Formato no admitido (usa JPG, PNG o WebP)');
    if (blob.size > LIMITS.img) throw new Error('La imagen pesa más de 25 MB');
    const bm = await bitmapOf(blob);
    try {
      const full = await drawTo(bm, opt.max || 2400, 'image/webp', opt.q || 0.86);
      const thumb = opt.noThumb ? null : await drawTo(bm, opt.thumb || 640, 'image/webp', 0.78);
      return { full: full.blob, thumb: thumb && thumb.blob, w: full.w, h: full.h };
    } finally { bm.close(); }
  }
  const extOf = b => (b.type === 'image/png' ? 'png' : b.type === 'image/jpeg' ? 'jpg' : 'webp');

  async function upload(path, blob) {
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw new Error('Subida: ' + error.message);
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const pathOf = url => {
    const m = String(url || '').match(new RegExp(`/object/public/${BUCKET}/(.+?)(?:\\?.*)?$`));
    return m ? decodeURIComponent(m[1]) : null;
  };
  async function removeFiles(urls) {
    const paths = [...new Set(urls.map(pathOf).filter(Boolean))];
    if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(e => console.warn('No se borró del almacenamiento', e));
  }
  /* Sube una imagen procesada y devuelve las URL + medidas */
  async function uploadProcessed(blob, folder, opt) {
    const p = await processImage(blob, opt);
    const id = uid();
    const image_url = await upload(`${folder}/${id}.${extOf(p.full)}`, p.full);
    const thumb_url = p.thumb ? await upload(`${folder}/${id}_t.${extOf(p.thumb)}`, p.thumb) : null;
    return { image_url, thumb_url, width: p.w, height: p.h };
  }

  /* ── Datos ───────────────────────────────────────────────── */
  const ok = r => { if (r.error) throw new Error(r.error.message); return r.data; };

  async function fetchDefaults() {
    // Lee los textos por defecto del propio sitio para precargar los formularios
    try {
      const html = await (await fetch('index.html', { cache: 'no-cache' })).text();
      const d = new DOMParser().parseFromString(html, 'text/html');
      const q = s => d.querySelector(s);
      return {
        lead: q('.hero-lead')?.textContent.trim() || '',
        about: { title: q('.about-main h2')?.textContent.trim() || 'Sobre mí', lead: q('.about-lead')?.textContent.trim() || '' },
        areas_title: d.querySelectorAll('.panel h3')[0]?.textContent.trim() || 'Áreas',
        tools_title: d.querySelectorAll('.panel h3')[1]?.textContent.trim() || 'Herramientas',
        areas: [...d.querySelectorAll('.areas li')].map(li => ({
          icon: (li.querySelector('use')?.getAttribute('href') || '').replace('#i-', '') || 'shapes',
          title: li.querySelector('strong')?.textContent.trim() || '', sub: li.querySelector('small')?.textContent.trim() || '' })),
        tools: [...d.querySelectorAll('.tools li')].map(li => ({
          name: li.textContent.trim(), abbr: li.querySelector('text')?.textContent.trim() || '',
          bg: li.querySelector('rect')?.getAttribute('fill') || '#2A1B4D', fg: li.querySelector('text')?.getAttribute('fill') || '#C4B5FD' })),
      };
    } catch { return { lead: '', about: { title: 'Sobre mí', lead: '' }, areas_title: 'Áreas', tools_title: 'Herramientas', areas: [], tools: [] }; }
  }

  async function loadAll() {
    const [w, a, d, s, loc] = await Promise.all([
      sb.from('works').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      sb.from('work_assets').select('*').order('sort_order', { ascending: true }),
      sb.from('pdf_documents').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      sb.from('site_settings').select('key,value'),
      fetch('data/local-content.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({})),
    ]);
    S.works = ok(w); S.assets = ok(a); S.docs = ok(d);
    S.settings = Object.fromEntries(ok(s).map(r => [r.key, r.value]));
    S.local = loc || {};
    const probe = await sb.from('works').select('tags').limit(1);
    S.tagsOk = !probe.error;
    S.defaults = S.defaults || await fetchDefaults();
  }
  async function saveSetting(key, value) {
    const { error } = await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
    S.settings[key] = value;
  }

  /* ── Contenido local (carpeta imagenes/) ─────────────────── */
  const localState = () => ({ imported: [], hidden: [], ...(S.settings.local_state || {}) });
  function localItems(kind) {
    const st = localState(), lk = KIND[kind].lk;
    return (S.local[lk] || []).filter(x => !st.imported.includes(x.image_url)).map(x => ({ ...x, local: true, off: st.hidden.includes(x.image_url) }));
  }
  const localPending = () => KINDS.reduce((n, k) => n + localItems(k.id).length, 0);

  async function importLocal(items, kind, quiet) {
    const total = items.length; let n = 0, bad = 0;
    for (const it of items) {
      try {
        progress(`Importando ${n + 1} de ${total}: ${it.title || it.image_url.split('/').pop()}`, n / total);
        const blob = await (await fetch(it.image_url)).blob();
        const img = await uploadProcessed(blob, `works/${kind}`, kind === 'logo' ? { q: 0.92 } : {});
        const row = {
          kind, title: it.title || '', description: it.description || null, category: it.category || null,
          image_url: img.image_url, thumb_url: img.thumb_url, width: img.width, height: img.height,
          sort_order: nextOrder(kind), visible: !localState().hidden.includes(it.image_url),
        };
        if (S.tagsOk && it.tags?.length) row.tags = it.tags;
        const work = ok(await sb.from('works').insert(row).select().single());
        S.works.push(work);
        if (kind === 'logo') {
          const vars = (it.variations || []).filter(v => v.image_url !== it.image_url);
          for (let i = 0; i < vars.length; i++) {
            const vb = await (await fetch(vars[i].image_url)).blob();
            const vi = await uploadProcessed(vb, 'works/logo', { q: 0.92, noThumb: true });
            S.assets.push(ok(await sb.from('work_assets').insert({ work_id: work.id, label: vars[i].label || '', image_url: vi.image_url, sort_order: i }).select().single()));
          }
        }
        const st = localState(); st.imported.push(it.image_url);
        await saveSetting('local_state', st);
        n++;
      } catch (e) { bad++; console.error(e); toast(`No se pudo importar ${it.image_url.split('/').pop()}: ${e.message}`, true); }
    }
    progress(null);
    if (!quiet) toast(`${n} importada${n === 1 ? '' : 's'}${bad ? `, ${bad} con error` : ''}.`, !!bad && !n);
    return { n, bad };
  }

  const worksOf = kind => S.works.filter(w => w.kind === kind);
  const nextOrder = kind => worksOf(kind).reduce((m, w) => Math.max(m, w.sort_order), 0) + 1;

  /* ── Navegación ──────────────────────────────────────────── */
  const VIEWS = { home: renderHome, works: renderWorks, pdf: renderPdf, site: renderSite };
  function go(view) {
    S.view = view;
    $$('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.view === view));
    $$('.view').forEach(v => v.hidden = v.id !== 'v-' + view);
    VIEWS[view]();
    store.set('ag_admin_view', view);
  }
  $$('.tab').forEach(t => t.onclick = () => { go(t.dataset.view); scrollTo({ top: 0 }); });

  async function run(fn, errCtx) { try { return await fn(); } catch (e) { fail(e, errCtx); progress(null); } }

  /* ══ RESUMEN ═════════════════════════════════════════════════ */
  function renderHome() {
    const el = $('#v-home'), pending = localPending();
    const cnt = k => worksOf(k).length + localItems(k).length;
    const visibleDocs = S.docs.filter(d => d.visible).length;
    const items = [
      [true, 'Conectado a Supabase como administradora.'],
      [!pending, pending ? `Tienes ${pending} pieza${pending === 1 ? '' : 's'} que solo existen en la carpeta del sitio. <a href="#" data-go="works" style="color:var(--accent);font-weight:600">Impórtalas para poder editarlas</a>.` : 'Todas las piezas están en la base de datos.'],
      [S.tagsOk, S.tagsOk ? 'Las etiquetas de Destacados están habilitadas.' : 'Falta habilitar las etiquetas de Destacados: ejecuta <b>supabase/03_etiquetas.sql</b> en Supabase.'],
      [S.docs.length > 0, S.docs.length ? `${visibleDocs} guía${visibleDocs === 1 ? '' : 's'} PDF publicada${visibleDocs === 1 ? '' : 's'}.` : 'Aún no hay guías PDF: la sección Guías permanece oculta hasta que subas una.'],
      [!!(S.settings.theme?.customized), S.settings.theme?.customized ? 'El sitio usa tu apariencia personalizada.' : 'El sitio usa la apariencia por defecto (violeta). Puedes cambiarla en Sitio → Apariencia.'],
    ];
    el.innerHTML = `
      <header><div><h2>Hola, Ana</h2><p>Desde aquí controlas todo lo que se ve en tu portafolio.</p></div></header>
      <div class="stats">
        ${KINDS.map(k => `<button class="stat" data-go="works" data-kind="${k.id}"><span class="ico">${ic(k.id === 'featured' ? 'star' : k.id === 'logo' ? 'palette' : 'image')}</span><div><strong>${cnt(k.id)}</strong><span>${k.label}</span></div></button>`).join('')}
        <button class="stat" data-go="pdf"><span class="ico">${ic('doc')}</span><div><strong>${S.docs.length}</strong><span>Guías PDF</span></div></button>
      </div>
      <div class="card"><h3>Estado del sitio</h3><ul class="todo">
        ${items.map(([good, t]) => `<li><span class="dot ${good ? 'ok' : ''}">${good ? ic('check') : ''}</span><span>${t}</span></li>`).join('')}
      </ul></div>`;
    el.onclick = e => {
      const g = e.target.closest('[data-go]'); if (!g) return; e.preventDefault();
      if (g.dataset.kind) S.kind = g.dataset.kind;
      go(g.dataset.go);
    };
  }

  /* ══ PIEZAS ══════════════════════════════════════════════════ */
  function renderWorks() {
    const el = $('#v-works'), k = KIND[S.kind];
    const db = worksOf(S.kind), loc = localItems(S.kind), pendAll = localPending();
    const chips = KINDS.map(x => `<button class="chip" data-kind="${x.id}" aria-pressed="${x.id === S.kind}">${x.label} <b>${worksOf(x.id).length + localItems(x.id).length}</b></button>`).join('');
    el.innerHTML = `
      <header><div><h2>Piezas</h2><p>${esc(k.hint)}</p></div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${pendAll ? `<button class="btn" data-act="import-all" data-tip="Sube a la base de datos todo lo que está solo en la carpeta">${ic('import')}Importar de la carpeta (${pendAll})</button>` : ''}
          <button class="btn primary" data-act="pick">${ic('upload')}Subir imágenes</button>
        </div></header>
      <div class="chips" role="group" aria-label="Tipo de pieza">${chips}</div>
      <div class="drop" id="drop"><strong>Arrastra imágenes aquí</strong><small>JPG, PNG o WebP · hasta 25 MB cada una · se optimizan solas antes de subirse</small></div>
      <div class="queue" id="queue"></div>
      ${S.kind === 'featured' ? `<div class="msg info">Destacados se muestra de a tres. El sitio centra solo la imagen más angosta; si prefieres respetar tu orden exacto, desactívalo en <b>Sitio → Textos</b>.</div>` : ''}
      ${S.kind === 'featured' && !S.tagsOk ? `<div class="msg warn">Para usar etiquetas en Destacados ejecuta <b>supabase/03_etiquetas.sql</b> en Supabase (una sola vez).</div>` : ''}
      ${db.length || loc.length ? `<div class="grid" id="grid">${db.map((w, i) => workCard(w, i, db.length)).join('')}${loc.map(localCard).join('')}</div>`
        : `<div class="empty-state"><span class="ico">${ic('image')}</span><strong>Aún no hay ${k.label.toLowerCase()}</strong><span>Sube tu primera imagen con el botón de arriba o arrastrándola aquí.</span></div>`}`;
    wireWorks(el);
  }
  const workCard = (w, i, n) => `
    <article class="work ${w.visible ? '' : 'off'}" data-id="${w.id}" draggable="true">
      <div class="pic"><img src="${esc(w.thumb_url || w.image_url)}" alt="" loading="lazy" decoding="async">
        <div class="badges">${w.visible ? '' : '<span class="badge off">Oculta</span>'}${S.assets.some(a => a.work_id === w.id) ? `<span class="badge">${S.assets.filter(a => a.work_id === w.id).length} variaciones</span>` : ''}</div>
        <span class="handle" aria-hidden="true">${ic('drag')}</span></div>
      <div class="body"><h4 class="${w.title ? '' : 'empty'}">${esc(w.title || 'Sin título')}</h4><p>${esc(w.category || w.description || '—')}</p></div>
      <div class="acts">
        <button class="icon-btn" data-act="left" data-tip="Mover antes" aria-label="Mover antes" ${i === 0 ? 'disabled' : ''}>${ic('left')}</button>
        <button class="icon-btn" data-act="right" data-tip="Mover después" aria-label="Mover después" ${i === n - 1 ? 'disabled' : ''}>${ic('right')}</button>
        <span class="sp"></span>
        <button class="icon-btn" data-act="vis" data-tip="${w.visible ? 'Ocultar del sitio' : 'Mostrar en el sitio'}" aria-label="${w.visible ? 'Ocultar' : 'Mostrar'}">${ic(w.visible ? 'eye' : 'eye-off')}</button>
        <button class="icon-btn" data-act="edit" data-tip="Editar" aria-label="Editar">${ic('edit')}</button>
        <button class="icon-btn danger" data-act="del" data-tip="Eliminar" aria-label="Eliminar">${ic('trash')}</button>
      </div>
    </article>`;
  const localCard = it => `
    <article class="work ${it.off ? 'off' : ''}" data-local="${esc(it.image_url)}">
      <div class="pic"><img src="${esc(it.image_url)}" alt="" loading="lazy" decoding="async">
        <div class="badges"><span class="badge local">Solo en carpeta</span>${it.off ? '<span class="badge off">Oculta</span>' : ''}</div></div>
      <div class="body"><h4 class="${it.title ? '' : 'empty'}">${esc(it.title || 'Sin título')}</h4><p>${esc(it.category || it.description || '—')}</p></div>
      <div class="acts"><button class="btn sm" data-act="imp" data-tip="Súbela para poder editarla">${ic('import')}Importar</button><span class="sp"></span>
        <button class="icon-btn" data-act="lvis" data-tip="${it.off ? 'Mostrar en el sitio' : 'Ocultar del sitio'}" aria-label="${it.off ? 'Mostrar' : 'Ocultar'}">${ic(it.off ? 'eye-off' : 'eye')}</button></div>
    </article>`;

  function wireWorks(el) {
    el.onclick = e => run(async () => {
      const chip = e.target.closest('.chip[data-kind]'); if (chip) { S.kind = chip.dataset.kind; return renderWorks(); }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const card = b.closest('.work'), id = card?.dataset.id, w = id && S.works.find(x => x.id === id);
      switch (b.dataset.act) {
        case 'pick': return pickFiles(files => uploadWorks(files));
        case 'import-all': {
          if (!await ask('Importar de la carpeta', `Se subirán ${localPending()} piezas a la base de datos (optimizadas). Después podrás editarlas, reordenarlas o eliminarlas desde aquí.`, 'Importar')) return;
          let n = 0, bad = 0;
          for (const k of KINDS) { const l = localItems(k.id); if (l.length) { const r = await importLocal(l, k.id, true); n += r.n; bad += r.bad; } }
          toast(`${n} pieza${n === 1 ? '' : 's'} importada${n === 1 ? '' : 's'}${bad ? `, ${bad} con error` : ''}.`, !!bad && !n);
          return renderWorks();
        }
        case 'imp': { const it = localItems(S.kind).find(x => x.image_url === card.dataset.local); await importLocal([it], S.kind); return renderWorks(); }
        case 'lvis': {
          const st = localState(), p = card.dataset.local, i = st.hidden.indexOf(p);
          i < 0 ? st.hidden.push(p) : st.hidden.splice(i, 1);
          await saveSetting('local_state', st); return renderWorks();
        }
        case 'vis': ok(await sb.from('works').update({ visible: !w.visible }).eq('id', id)); w.visible = !w.visible; toast(w.visible ? 'Visible en el sitio' : 'Oculta del sitio'); return renderWorks();
        case 'left': case 'right': return moveWork(id, b.dataset.act === 'left' ? -1 : 1);
        case 'edit': return editWork(w);
        case 'del': {
          if (!await ask('Eliminar pieza', `¿Eliminar «${w.title || 'Sin título'}»? Se borrará también su imagen${w.kind === 'logo' ? ' y sus variaciones' : ''}. No se puede deshacer.`, 'Eliminar', true)) return;
          await deleteWork(w); toast('Pieza eliminada'); return renderWorks();
        }
      }
    });
    // Subir arrastrando
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
    drop.addEventListener('drop', e => { e.preventDefault(); const f = [...e.dataTransfer.files]; if (f.length) uploadWorks(f); });
    drop.addEventListener('click', () => pickFiles(files => uploadWorks(files)));
    // Reordenar arrastrando tarjetas
    const grid = $('#grid'); if (!grid) return;
    let dragId = null;
    grid.addEventListener('dragstart', e => { const c = e.target.closest('.work[data-id]'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
    grid.addEventListener('dragend', () => { dragId = null; $$('.work', grid).forEach(c => c.classList.remove('dragging', 'dropbefore')); });
    grid.addEventListener('dragover', e => { if (!dragId) return; const c = e.target.closest('.work[data-id]'); if (!c) return; e.preventDefault(); $$('.dropbefore', grid).forEach(x => x.classList.remove('dropbefore')); if (c.dataset.id !== dragId) c.classList.add('dropbefore'); });
    grid.addEventListener('drop', e => run(async () => {
      if (!dragId) return; const c = e.target.closest('.work[data-id]'); if (!c || c.dataset.id === dragId) return; e.preventDefault();
      const list = worksOf(S.kind), from = list.findIndex(x => x.id === dragId), to = list.findIndex(x => x.id === c.dataset.id);
      const [m] = list.splice(from, 1); list.splice(to, 0, m); await persistOrder(list); renderWorks();
    }));
  }

  async function persistOrder(list) {
    const jobs = [];
    list.forEach((w, i) => { if (w.sort_order !== i + 1) { w.sort_order = i + 1; jobs.push(sb.from('works').update({ sort_order: i + 1 }).eq('id', w.id).then(ok)); } });
    await Promise.all(jobs);
    S.works.sort((a, b) => a.sort_order - b.sort_order);
  }
  async function moveWork(id, dir) {
    const list = worksOf(S.kind), i = list.findIndex(x => x.id === id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; await persistOrder(list); renderWorks();
    $(`.work[data-id="${id}"] [data-act="${dir < 0 ? 'left' : 'right'}"]`)?.focus();
  }
  async function deleteWork(w) {
    const urls = [w.image_url, w.thumb_url, ...S.assets.filter(a => a.work_id === w.id).map(a => a.image_url)];
    ok(await sb.from('works').delete().eq('id', w.id));
    await removeFiles(urls);
    S.works = S.works.filter(x => x.id !== w.id); S.assets = S.assets.filter(a => a.work_id !== w.id);
  }

  function pickFiles(cb, accept = 'image/jpeg,image/png,image/webp', multiple = true) {
    const f = $('#filePick'); f.value = ''; f.accept = accept; f.multiple = multiple;
    f.onchange = () => { const files = [...f.files]; f.value = ''; if (files.length) cb(files); };
    f.click();
  }

  async function uploadWorks(files) {
    const kind = S.kind, q = $('#queue');
    const rows = files.map(f => { const d = document.createElement('div'); d.className = 'q'; d.innerHTML = `<div class="t"><span>${esc(f.name)}</span><span>En espera</span></div>`; q && q.appendChild(d); return d; });
    const setS = (i, t, cls) => { const d = rows[i]; d.className = 'q ' + (cls || ''); d.querySelector('.t span:last-child').textContent = t; };
    let n = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        setS(i, 'Optimizando y subiendo…');
        const img = await uploadProcessed(files[i], `works/${kind}`, kind === 'logo' ? { q: 0.92 } : {});
        const title = files[i].name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        const row = { kind, title: kind === 'featured' || kind === 'logo' ? title : '', category: DEFAULT_CAT[kind] || null, ...img, sort_order: nextOrder(kind), visible: true };
        S.works.push(ok(await sb.from('works').insert(row).select().single()));
        setS(i, 'Listo', 'done'); n++;
      } catch (e) { setS(i, e.message, 'err'); }
    }
    if (n) { toast(`${n} imagen${n === 1 ? '' : 'es'} subida${n === 1 ? '' : 's'}. Ya está${n === 1 ? '' : 'n'} en el sitio.`); await sleep(900); if (S.view === 'works' && S.kind === kind) renderWorks(); }
  }

  /* ── Editar pieza ── */
  async function editWork(w) {
    const vars = w.kind === 'logo' ? S.assets.filter(a => a.work_id === w.id).map(a => ({ ...a })) : [];
    let newImage = null, tags = [...(w.tags || [])];
    const F = { title: w.title || '', category: w.category || '', description: w.description || '', kind: w.kind, visible: w.visible };
    const cats = [...new Set(S.works.map(x => x.category).filter(Boolean))];
    const body = document.createElement('div');
    const draw = () => {
      body.innerHTML = `
        <div class="edit-pic"><div class="pic"><img id="ePic" src="${esc(newImage ? URL.createObjectURL(newImage) : (w.thumb_url || w.image_url))}" alt=""></div>
          <div><button class="btn sm" data-a="replace">${ic('upload')}Cambiar imagen</button><p class="hint" style="margin-top:.4rem;font-size:.78rem;color:var(--text-3)">${w.width && w.height ? `${w.width}×${w.height}px` : ''}${newImage ? ' · nueva imagen lista' : ''}</p></div></div>
        <div class="row2"><div class="field"><label for="eTitle">Título</label><input type="text" id="eTitle" maxlength="90" value="${esc(F.title)}"></div>
          <div class="field"><label for="eKind">Tipo</label><select id="eKind">${KINDS.map(k => `<option value="${k.id}" ${k.id === F.kind ? 'selected' : ''}>${k.label}</option>`).join('')}</select></div></div>
        <div class="field"><label for="eCat">Categoría</label><input type="text" id="eCat" list="catList" maxlength="60" value="${esc(F.category)}"><datalist id="catList">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          <span class="hint">Las categorías de Mockups, Diseños e Ilustraciones se usan como filtros en la galería.</span></div>
        <div class="field"><label for="eDesc">Descripción</label><textarea id="eDesc" maxlength="300">${esc(F.description)}</textarea></div>
        ${w.kind === 'featured' && S.tagsOk ? `<div class="field"><label>Etiquetas</label><div class="tagbox" id="tagbox">${tags.map((t, i) => `<span>${esc(t)}<button type="button" data-rt="${i}" aria-label="Quitar ${esc(t)}">${ic('x')}</button></span>`).join('')}<input type="text" id="tagIn" placeholder="Escribe y pulsa Enter" maxlength="24"></div></div>` : ''}
        <label class="switch" style="margin-bottom:1rem"><input type="checkbox" id="eVis" ${F.visible ? 'checked' : ''}><span class="tr"></span>Visible en el sitio</label>
        ${w.kind === 'logo' ? `<div class="sub-h" style="margin-top:.6rem"><div><h3>Variaciones</h3><p>Versión blanca, negra, horizontal… Se muestran junto al logo principal.</p></div><button class="btn sm" data-a="addvar">${ic('plus')}Añadir</button></div>
          <div class="vars">${vars.filter(v => !v.del).map((v, i, arr) => `<div class="var" data-vi="${vars.indexOf(v)}"><div class="pic"><img src="${esc(v.file ? URL.createObjectURL(v.file) : v.image_url)}" alt=""></div>
            <input class="in" type="text" data-vl="${vars.indexOf(v)}" value="${esc(v.label)}" placeholder="Nombre (p. ej. Blanco)" maxlength="40" aria-label="Nombre de la variación">
            <div class="acts"><button class="icon-btn" data-a="vup" ${i === 0 ? 'disabled' : ''} data-tip="Subir" aria-label="Subir">${ic('up')}</button><button class="icon-btn" data-a="vdown" ${i === arr.length - 1 ? 'disabled' : ''} data-tip="Bajar" aria-label="Bajar">${ic('down')}</button><button class="icon-btn danger" data-a="vdel" data-tip="Quitar" aria-label="Quitar">${ic('trash')}</button></div></div>`).join('') || '<p class="hint" style="color:var(--text-3)">Sin variaciones todavía.</p>'}</div>` : ''}`;
    };
    const keep = () => {
      const g = id => $(id, body); if (!g('#eTitle')) return;
      F.title = g('#eTitle').value; F.category = g('#eCat').value; F.description = g('#eDesc').value; F.kind = g('#eKind').value; F.visible = g('#eVis').checked;
      $$('[data-vl]', body).forEach(i => vars[+i.dataset.vl].label = i.value);
    };
    const redraw = () => { keep(); draw(); };
    draw();
    const foot = document.createElement('div');
    foot.innerHTML = `<button class="btn danger" data-a="del">${ic('trash')}Eliminar</button><div class="r"><button class="btn" data-a="cancel">Cancelar</button><button class="btn primary" data-a="save">Guardar cambios</button></div>`;
    const result = openDlg({ title: 'Editar pieza', body, foot, wide: w.kind === 'logo' });
    const tagAdd = () => { const i = $('#tagIn', body); const v = i?.value.trim().replace(/,$/, ''); if (v && tags.length < 6 && !tags.includes(v)) { tags.push(v); redraw(); $('#tagIn', body)?.focus(); } else if (i) i.value = ''; };
    body.addEventListener('keydown', e => { if (e.target.id === 'tagIn' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); tagAdd(); } });
    body.addEventListener('click', e => {
      const rt = e.target.closest('[data-rt]'); if (rt) { tags.splice(+rt.dataset.rt, 1); return redraw(); }
      const b = e.target.closest('[data-a]'); if (!b) return; const vi = b.closest('.var') ? +b.closest('.var').dataset.vi : -1;
      if (b.dataset.a === 'replace') pickFiles(f => { newImage = f[0]; redraw(); }, 'image/jpeg,image/png,image/webp', false);
      if (b.dataset.a === 'addvar') pickFiles(fs => { fs.forEach(f => vars.push({ label: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), file: f, new: true })); redraw(); });
      if (b.dataset.a === 'vdel') { vars[vi].del = true; redraw(); }
      if (b.dataset.a === 'vup' || b.dataset.a === 'vdown') {
        const live = vars.map((v, i) => i).filter(i => !vars[i].del), p = live.indexOf(vi), q = live[p + (b.dataset.a === 'vup' ? -1 : 1)];
        if (q != null) { [vars[vi], vars[q]] = [vars[q], vars[vi]]; redraw(); }
      }
    });
    foot.addEventListener('click', e => run(async () => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'cancel') return closeDlg(null);
      if (a === 'del') { closeDlg(null); if (await ask('Eliminar pieza', `¿Eliminar «${w.title || 'Sin título'}»? No se puede deshacer.`, 'Eliminar', true)) { await deleteWork(w); toast('Pieza eliminada'); renderWorks(); } return; }
      if (a === 'save') {
        keep();
        const btn = e.target.closest('button'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Guardando…';
        try {
          const patch = { title: F.title.trim(), category: F.category.trim() || null, description: F.description.trim() || null, kind: F.kind, visible: F.visible };
          if (S.tagsOk && w.kind === 'featured') patch.tags = tags;
          const old = [];
          if (newImage) { const img = await uploadProcessed(newImage, `works/${patch.kind}`, patch.kind === 'logo' ? { q: 0.92 } : {}); old.push(w.image_url, w.thumb_url); Object.assign(patch, img); }
          if (patch.kind !== w.kind) patch.sort_order = nextOrder(patch.kind);
          const upd = ok(await sb.from('works').update(patch).eq('id', w.id).select().single());
          Object.assign(w, upd);
          if (patch.kind === 'logo' || vars.length) {
            for (const v of vars) {
              if (v.del && v.id) { ok(await sb.from('work_assets').delete().eq('id', v.id)); old.push(v.image_url); S.assets = S.assets.filter(a => a.id !== v.id); }
            }
            let order = 0;
            for (const v of vars.filter(x => !x.del)) {
              if (v.new) { const vi = await uploadProcessed(v.file, 'works/logo', { q: 0.92, noThumb: true }); const r = ok(await sb.from('work_assets').insert({ work_id: w.id, label: v.label.trim(), image_url: vi.image_url, sort_order: order }).select().single()); S.assets.push(r); }
              else { ok(await sb.from('work_assets').update({ label: v.label.trim(), sort_order: order }).eq('id', v.id)); const a = S.assets.find(x => x.id === v.id); if (a) { a.label = v.label.trim(); a.sort_order = order; } }
              order++;
            }
          }
          await removeFiles(old.filter(Boolean));
          toast('Cambios guardados'); closeDlg(true); renderWorks();
        } catch (err) { btn.disabled = false; btn.textContent = 'Guardar cambios'; throw err; }
      }
    }, 'No se pudo guardar'));
    return result;
  }

  /* ══ GUÍAS PDF ═══════════════════════════════════════════════ */
  function renderPdf() {
    const el = $('#v-pdf');
    el.innerHTML = `
      <header><div><h2>Guías PDF</h2><p>Sube un PDF y el panel lo convierte en páginas ligeras para que se vea rápido en el sitio. Nada de PDFs pesados.</p></div>
        <button class="btn primary" data-act="new">${ic('upload')}Subir PDF</button></header>
      <div class="drop" id="drop"><strong>Arrastra un PDF aquí</strong><small>Hasta 80 MB y ${LIMITS.pdfPages} páginas · se convierte en tu navegador</small></div>
      ${S.docs.length ? `<div class="stack">${S.docs.map((d, i) => `
        <article class="doc ${d.visible ? '' : 'off'}" data-id="${d.id}">
          <div class="cov">${d.cover_url ? `<img src="${esc(d.cover_url)}" alt="" loading="lazy">` : ''}</div>
          <div><h4>${esc(d.title)}</h4><p>${[d.client, d.year, `${d.page_count} página${d.page_count === 1 ? '' : 's'}`].filter(Boolean).map(esc).join(' · ')}${d.visible ? '' : ' · <b style="color:var(--warn)">Oculta</b>'}</p></div>
          <div class="acts">
            <button class="icon-btn" data-act="up" data-tip="Subir en la lista" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ic('up')}</button>
            <button class="icon-btn" data-act="down" data-tip="Bajar en la lista" aria-label="Bajar" ${i === S.docs.length - 1 ? 'disabled' : ''}>${ic('down')}</button>
            <button class="icon-btn" data-act="vis" data-tip="${d.visible ? 'Ocultar del sitio' : 'Mostrar en el sitio'}" aria-label="${d.visible ? 'Ocultar' : 'Mostrar'}">${ic(d.visible ? 'eye' : 'eye-off')}</button>
            <button class="icon-btn" data-act="edit" data-tip="Editar datos" aria-label="Editar">${ic('edit')}</button>
            <button class="icon-btn danger" data-act="del" data-tip="Eliminar" aria-label="Eliminar">${ic('trash')}</button>
          </div></article>`).join('')}</div>`
        : `<div class="empty-state"><span class="ico">${ic('doc')}</span><strong>Todavía no hay guías</strong><span>La sección Guías del sitio se mantiene oculta hasta que subas la primera.</span></div>`}`;
    const pick = () => pickFiles(f => newDoc(f[0]), 'application/pdf', false);
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
    drop.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) newDoc(f); });
    drop.addEventListener('click', pick);
    el.onclick = e => run(async () => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'new') return pick();
      const id = b.closest('.doc')?.dataset.id, d = S.docs.find(x => x.id === id), i = S.docs.indexOf(d);
      if (b.dataset.act === 'vis') { ok(await sb.from('pdf_documents').update({ visible: !d.visible }).eq('id', id)); d.visible = !d.visible; return renderPdf(); }
      if (b.dataset.act === 'up' || b.dataset.act === 'down') {
        const j = i + (b.dataset.act === 'up' ? -1 : 1); [S.docs[i], S.docs[j]] = [S.docs[j], S.docs[i]];
        await Promise.all(S.docs.map((x, n) => x.sort_order === n + 1 ? null : (x.sort_order = n + 1, sb.from('pdf_documents').update({ sort_order: n + 1 }).eq('id', x.id).then(ok)))); return renderPdf();
      }
      if (b.dataset.act === 'edit') return editDoc(d);
      if (b.dataset.act === 'del') {
        if (!await ask('Eliminar guía', `¿Eliminar «${d.title}» con todas sus páginas? No se puede deshacer.`, 'Eliminar', true)) return;
        const pages = ok(await sb.from('pdf_pages').select('image_url,thumb_url').eq('document_id', id));
        ok(await sb.from('pdf_documents').delete().eq('id', id));
        await removeFiles([d.cover_url, d.source_url, ...pages.flatMap(p => [p.image_url, p.thumb_url])]);
        S.docs = S.docs.filter(x => x.id !== id); toast('Guía eliminada'); renderPdf();
      }
    });
  }

  let pdfLib = null;
  function loadPdfJs() {
    if (pdfLib) return pdfLib;
    const V = '3.11.174', base = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${V}/`;
    return pdfLib = new Promise((res, rej) => {
      if (window.pdfjsLib) return res(window.pdfjsLib);
      const s = document.createElement('script'); s.src = base + 'pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = () => { pdfLib = null; rej(new Error('No se pudo cargar el lector de PDF. Revisa tu conexión.')); };
      document.head.appendChild(s);
    });
  }
  const slugify = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'guia';

  async function newDoc(file) {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return toast('Elige un archivo PDF', true);
    if (file.size > LIMITS.pdf) return toast('El PDF pesa más de 80 MB', true);
    const body = document.createElement('div');
    body.innerHTML = `<p class="msg info">${esc(file.name)} · ${(file.size / 1048576).toFixed(1)} MB</p>
      <div class="field"><label for="pTitle">Título</label><input type="text" id="pTitle" maxlength="90" value="${esc(file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' '))}"></div>
      <div class="row2"><div class="field"><label for="pClient">Cliente o marca</label><input type="text" id="pClient" maxlength="70"></div>
        <div class="field"><label for="pYear">Año</label><input type="number" id="pYear" min="1990" max="2100" value="${new Date().getFullYear()}"></div></div>
      <div class="field"><label for="pDesc">Descripción</label><textarea id="pDesc" maxlength="300"></textarea></div>
      <div id="pProg" hidden><div class="bar"><i></i></div><p class="hint" style="margin-top:.5rem;font-size:.85rem;color:var(--text-2)"></p></div>`;
    const foot = document.createElement('div'); foot.innerHTML = `<span></span><div class="r"><button class="btn" data-a="cancel">Cancelar</button><button class="btn primary" data-a="go">Convertir y publicar</button></div>`;
    let working = false;
    foot.onclick = e => run(async () => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'cancel' && !working) return closeDlg(null);
      if (a !== 'go' || working) return;
      const title = $('#pTitle', body).value.trim(); if (!title) return toast('Escribe un título', true);
      working = true; $$('button,input,textarea', dlg).forEach(x => x.disabled = true); $('#pProg', body).hidden = false;
      const bar = $('#pProg .bar i', body), txt = $('#pProg p', body);
      try {
        await convertPdf(file, { title, client: $('#pClient', body).value.trim() || null, year: +$('#pYear', body).value || null, description: $('#pDesc', body).value.trim() || null },
          (t, p) => { txt.textContent = t; bar.style.width = Math.round(p * 100) + '%'; });
        closeDlg(true); toast('Guía publicada'); renderPdf();
      } catch (err) { working = false; $$('button,input,textarea', dlg).forEach(x => x.disabled = false); $('#pProg', body).hidden = true; throw err; }
    }, 'No se pudo convertir el PDF');
    openDlg({ title: 'Nueva guía', body, foot });
  }

  async function convertPdf(file, meta, onP) {
    onP('Preparando el lector de PDF…', 0.02);
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    const total = pdf.numPages;
    if (total > LIMITS.pdfPages) throw new Error(`El PDF tiene ${total} páginas (máximo ${LIMITS.pdfPages})`);
    const slugBase = slugify(meta.title); let slug = slugBase;
    if (S.docs.some(d => d.slug === slug)) slug += '-' + uid().slice(0, 4);
    const folder = `pdf/${slug}`;
    const doc = ok(await sb.from('pdf_documents').insert({ slug, ...meta, page_count: 0, visible: false, sort_order: S.docs.length + 1 }).select().single());
    const urls = [];
    try {
      const rows = []; let orient = 'portrait', cover = null;
      for (let n = 1; n <= total; n++) {
        onP(`Convirtiendo página ${n} de ${total}…`, 0.05 + 0.9 * (n - 1) / total);
        const page = await pdf.getPage(n), vp1 = page.getViewport({ scale: 1 });
        const k = Math.min(3, 1800 / Math.max(vp1.width, vp1.height)), vp = page.getViewport({ scale: k });
        const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: cx, viewport: vp }).promise;
        const full = await toBlob(cv, 'image/webp', 0.82);
        const tk = 420 / Math.max(cv.width, cv.height), tc = document.createElement('canvas'); tc.width = Math.round(cv.width * tk); tc.height = Math.round(cv.height * tk);
        tc.getContext('2d').drawImage(cv, 0, 0, tc.width, tc.height);
        const thumb = await toBlob(tc, 'image/webp', 0.72);
        const id = String(n).padStart(3, '0');
        const image_url = await upload(`${folder}/${id}.webp`, full), thumb_url = await upload(`${folder}/${id}_t.webp`, thumb);
        urls.push(image_url, thumb_url);
        rows.push({ document_id: doc.id, page_number: n, image_url, thumb_url, width: cv.width, height: cv.height });
        if (n === 1) { cover = thumb_url; const r = cv.width / cv.height; orient = r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square'; }
        page.cleanup(); cv.width = cv.height = tc.width = tc.height = 0;
      }
      onP('Guardando…', 0.97);
      ok(await sb.from('pdf_pages').insert(rows));
      const upd = ok(await sb.from('pdf_documents').update({ page_count: total, cover_url: cover, orientation: orient, visible: true }).eq('id', doc.id).select().single());
      S.docs.push(upd);
    } catch (e) {
      await sb.from('pdf_documents').delete().eq('id', doc.id); await removeFiles(urls); throw e;
    }
  }

  function editDoc(d) {
    const body = document.createElement('div');
    body.innerHTML = `<div class="field"><label for="dT">Título</label><input type="text" id="dT" maxlength="90" value="${esc(d.title)}"></div>
      <div class="row2"><div class="field"><label for="dC">Cliente o marca</label><input type="text" id="dC" maxlength="70" value="${esc(d.client || '')}"></div>
        <div class="field"><label for="dY">Año</label><input type="number" id="dY" min="1990" max="2100" value="${d.year || ''}"></div></div>
      <div class="field"><label for="dD">Descripción</label><textarea id="dD" maxlength="300">${esc(d.description || '')}</textarea></div>`;
    const foot = document.createElement('div'); foot.innerHTML = `<span></span><div class="r"><button class="btn" data-a="c">Cancelar</button><button class="btn primary" data-a="s">Guardar</button></div>`;
    foot.onclick = e => run(async () => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'c') return closeDlg(null); if (a !== 's') return;
      const t = $('#dT', body).value.trim(); if (!t) return toast('Escribe un título', true);
      const patch = { title: t, client: $('#dC', body).value.trim() || null, year: +$('#dY', body).value || null, description: $('#dD', body).value.trim() || null };
      ok(await sb.from('pdf_documents').update(patch).eq('id', d.id)); Object.assign(d, patch); closeDlg(true); toast('Guardado'); renderPdf();
    });
    openDlg({ title: 'Editar guía', body, foot });
  }

  /* ══ SITIO (textos, contacto, secciones, apariencia, cuenta) ═ */
  const SITE_TABS = [['texts', 'Textos'], ['contact', 'Contacto'], ['sections', 'Secciones'], ['look', 'Apariencia'], ['account', 'Cuenta']];
  let siteTab = 'texts';
  function renderSite() {
    const el = $('#v-site');
    el.innerHTML = `<header><div><h2>Sitio</h2><p>Los textos, colores y secciones de tu portafolio.</p></div></header>
      <div class="chips" role="group" aria-label="Ajustes">${SITE_TABS.map(([id, l]) => `<button class="chip" data-st="${id}" aria-pressed="${id === siteTab}">${l}</button>`).join('')}</div>
      <div id="siteBody"></div>`;
    el.onclick = e => { const c = e.target.closest('[data-st]'); if (c) { siteTab = c.dataset.st; renderSite(); } };
    ({ texts: siteTexts, contact: siteContact, sections: siteSections, look: siteLook, account: siteAccount })[siteTab]($('#siteBody'));
  }
  const saveBar = (id = 'saveBtn', label = 'Guardar cambios') => `<div class="savebar"><button class="btn primary" id="${id}">${label}</button></div>`;
  const withSave = (btn, fn) => btn.onclick = () => run(async () => {
    btn.disabled = true; const t = btn.textContent; btn.innerHTML = '<span class="spin"></span>Guardando…';
    try { await fn(); toast('Guardado. El sitio ya lo muestra.'); } finally { btn.disabled = false; btn.textContent = t; }
  }, 'No se pudo guardar');

  function siteTexts(el) {
    const D = S.defaults, hero = S.settings.hero || {}, ab = S.settings.about || {}, ft = S.settings.featured || {};
    const areas = (ab.areas?.length ? ab.areas : D.areas).map(a => ({ ...a })), tools = (ab.tools?.length ? ab.tools : D.tools).map(t => ({ ...t }));
    const drawHtml = () => {
      el.innerHTML = `<div class="stack">
        <div class="card"><h3>Portada</h3><div class="field"><label for="tLead">Frase bajo tu nombre</label><textarea id="tLead" maxlength="220">${esc(hero.lead ?? D.lead)}</textarea><span class="hint">Máximo 220 caracteres.</span></div></div>
        <div class="card"><h3>Sobre mí</h3>
          <div class="field"><label for="aTitle">Título</label><input type="text" id="aTitle" maxlength="60" value="${esc(ab.title ?? D.about.title)}"></div>
          <div class="field"><label for="aLead">Presentación</label><textarea id="aLead" maxlength="700" style="min-height:130px">${esc(ab.lead ?? D.about.lead)}</textarea><span class="hint">Máximo 700 caracteres.</span></div>
          <label class="switch"><input type="checkbox" id="aFacts" ${ab.show_facts === false ? '' : 'checked'}><span class="tr"></span>Mostrar el resumen con el número de piezas</label></div>
        <div class="card"><h3>Áreas de trabajo <small>hasta 8</small></h3>
          <div class="field"><label for="aAT">Título del bloque</label><input type="text" id="aAT" maxlength="60" value="${esc(ab.areas_title ?? D.areas_title)}"></div>
          <div class="list-edit" id="areaList">${areas.map((a, i) => `<div class="li-row" data-i="${i}"><select class="in" data-f="icon" aria-label="Ícono">${AREA_ICONS.map(([v, l]) => `<option value="${v}" ${v === a.icon ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <input class="in" data-f="title" value="${esc(a.title)}" placeholder="Título" maxlength="50" aria-label="Título"><input class="in" data-f="sub" value="${esc(a.sub || '')}" placeholder="Descripción corta" maxlength="80" aria-label="Descripción">
            <button class="icon-btn danger" data-del="${i}" data-tip="Quitar" aria-label="Quitar">${ic('trash')}</button></div>`).join('')}</div>
          ${areas.length < 8 ? `<button class="btn sm" id="addArea" style="margin-top:.8rem">${ic('plus')}Añadir área</button>` : ''}</div>
        <div class="card"><h3>Herramientas <small>hasta 12</small></h3>
          <div class="field"><label for="aTT">Título del bloque</label><input type="text" id="aTT" maxlength="60" value="${esc(ab.tools_title ?? D.tools_title)}"></div>
          <div class="list-edit" id="toolList">${tools.map((t, i) => `<div class="li-row tool" data-i="${i}"><input class="in" data-f="name" value="${esc(t.name)}" placeholder="Nombre (Photoshop)" maxlength="30" aria-label="Nombre">
            <input class="in" data-f="abbr" value="${esc(t.abbr || '')}" placeholder="Ps" maxlength="2" aria-label="Sigla (2 letras)">
            <span style="display:flex;gap:.3rem;align-items:center"><input type="color" data-f="bg" value="${esc(t.bg || '#2A1B4D')}" aria-label="Color de fondo" data-tip="Fondo" style="width:30px;height:30px;border:0;padding:0;background:none"><input type="color" data-f="fg" value="${esc(t.fg || '#C4B5FD')}" aria-label="Color de la sigla" data-tip="Sigla" style="width:30px;height:30px;border:0;padding:0;background:none">
            <button class="icon-btn danger" data-delt="${i}" data-tip="Quitar" aria-label="Quitar">${ic('trash')}</button></span></div>`).join('')}</div>
          ${tools.length < 12 ? `<button class="btn sm" id="addTool" style="margin-top:.8rem">${ic('plus')}Añadir herramienta</button>` : ''}</div>
        <div class="card"><h3>Destacados</h3><label class="switch"><input type="checkbox" id="fAuto" ${ft.auto_center === false ? '' : 'checked'}><span class="tr"></span>Centrar automáticamente la imagen más angosta</label>
          <p class="hint" style="margin-top:.5rem;font-size:.82rem;color:var(--text-3)">Si lo apagas, se respeta exactamente el orden que definas en Piezas → Destacados.</p></div>
      </div>${saveBar()}`;
    };
    const collect = () => {
      $$('#areaList .li-row', el).forEach(r => $$('[data-f]', r).forEach(i => areas[+r.dataset.i][i.dataset.f] = i.value));
      $$('#toolList .li-row', el).forEach(r => $$('[data-f]', r).forEach(i => tools[+r.dataset.i][i.dataset.f] = i.value));
      hero.lead = $('#tLead', el).value;
      Object.assign(ab, { title: $('#aTitle', el).value, lead: $('#aLead', el).value, areas_title: $('#aAT', el).value, tools_title: $('#aTT', el).value, show_facts: $('#aFacts', el).checked });
      ft.auto_center = $('#fAuto', el).checked;
    };
    const bindSave = () => {
      withSave($('#saveBtn', el), async () => {
        collect();
        const clean = (list, req) => list.filter(x => x[req].trim()).map(x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, String(v).trim()])));
        await saveSetting('hero', { ...S.settings.hero, lead: $('#tLead').value.trim() });
        await saveSetting('about', { ...S.settings.about, title: $('#aTitle').value.trim(), lead: $('#aLead').value.trim(), show_facts: $('#aFacts').checked,
          areas_title: $('#aAT').value.trim(), tools_title: $('#aTT').value.trim(), areas: clean(areas, 'title'), tools: clean(tools, 'name') });
        await saveSetting('featured', { ...S.settings.featured, auto_center: $('#fAuto').checked });
      });
    };
    const draw = () => { drawHtml(); bindSave(); };
    draw();
    el.addEventListener('click', e => {
      const a = e.target.closest('#addArea, #addTool, [data-del], [data-delt]'); if (!a) return; collect();
      if (a.id === 'addArea') areas.push({ icon: 'shapes', title: '', sub: '' });
      else if (a.id === 'addTool') tools.push({ name: '', abbr: '', bg: '#2A1B4D', fg: '#C4B5FD' });
      else if (a.dataset.del != null) areas.splice(+a.dataset.del, 1); else tools.splice(+a.dataset.delt, 1);
      draw();
    });
  }

  function siteContact(el) {
    const c = S.settings.contact || {};
    el.innerHTML = `<div class="card"><h3>Datos de contacto</h3>
      <div class="field"><label for="cWa">WhatsApp</label><input type="tel" id="cWa" inputmode="numeric" value="${esc(c.whatsapp || '')}" placeholder="51977575523"><span class="hint">Con código de país y sin signos ni espacios. Ej.: 51977575523.</span></div>
      <div class="field"><label for="cMail">Correo</label><input type="email" id="cMail" value="${esc(c.email || '')}" placeholder="tucorreo@gmail.com"><span class="hint">Si lo dejas vacío, no se muestra.</span></div>
      <div class="field"><label for="cIg">Instagram</label><input type="text" id="cIg" value="${esc(c.instagram || '')}" placeholder="@tu_usuario"><span class="hint">Solo el usuario. Si lo dejas vacío, no se muestra.</span></div>
      <div id="cErr" class="msg err" hidden></div></div>${saveBar()}`;
    withSave($('#saveBtn', el), async () => {
      const wa = $('#cWa', el).value.replace(/\D/g, ''), mail = $('#cMail', el).value.trim(), ig = $('#cIg', el).value.trim().replace(/^@/, '').replace(/[^\w.]/g, ''), err = $('#cErr', el);
      const bad = (wa && (wa.length < 8 || wa.length > 15)) ? 'El WhatsApp debe tener entre 8 y 15 dígitos.' : (mail && !/^\S+@\S+\.\S+$/.test(mail)) ? 'El correo no parece válido.' : '';
      err.hidden = !bad; err.textContent = bad; if (bad) throw new Error(bad);
      await saveSetting('contact', { whatsapp: wa, email: mail, instagram: ig });
    });
  }

  function siteSections(el) {
    const cur = S.settings.sections?.length ? S.settings.sections : [{ id: 'destacados', label: 'Destacados', visible: true }, { id: 'galeria', label: 'Galería', visible: true }, { id: 'logos', label: 'Logos', visible: true }, { id: 'guias', label: 'Guías', visible: true }];
    el.innerHTML = `<div class="card"><h3>Secciones del sitio</h3><p class="hint" style="margin:-.4rem 0 1rem;color:var(--text-2);font-size:.88rem">Oculta una sección completa o cambia el nombre que aparece en el menú. Guías se oculta sola mientras no haya PDFs.</p>
      ${cur.map(s => `<div class="sec-row" data-id="${esc(s.id)}"><b>${esc(SECTION_IDS.find(x => x[0] === s.id)?.[1] || s.id)}</b><input class="in" type="text" value="${esc(s.label)}" maxlength="24" aria-label="Nombre en el menú"><label class="switch"><input type="checkbox" ${s.visible === false ? '' : 'checked'}><span class="tr"></span><span class="sr">Visible</span></label></div>`).join('')}</div>${saveBar()}`;
    withSave($('#saveBtn', el), async () => {
      await saveSetting('sections', $$('.sec-row', el).map(r => ({ id: r.dataset.id, label: $('input[type=text]', r).value.trim() || r.dataset.id, visible: $('input[type=checkbox]', r).checked })));
    });
  }

  function siteLook(el) {
    const t = S.settings.theme || {}, c = t.colors || {}, d = c.dark || {}, f = t.fonts || {}, secs = t.sections || {};
    const colorF = (path, label, val, def) => `<div class="color ${val ? '' : 'unset'}" data-path="${path}"><input type="color" value="${esc(val || def)}" ${val ? 'data-set="1"' : ''} aria-label="${esc(label)}"><span>${esc(label)}<small>${val ? esc(val) : 'Por defecto'}</small></span><button class="icon-btn ghost" type="button" data-clear data-tip="Volver al color por defecto" aria-label="Restablecer ${esc(label)}">${ic('x')}</button></div>`;
    const sel = (id, list, val, ph) => `<select id="${id}"><option value="">${ph}</option>${list.map(x => `<option ${x === val ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
    el.innerHTML = `<div class="stack">
      <div class="card"><label class="switch"><input type="checkbox" id="custom" ${t.customized ? 'checked' : ''}><span class="tr"></span><b>Usar apariencia personalizada</b></label>
        <p class="hint" style="margin:.5rem 0 0;font-size:.85rem;color:var(--text-2)">Apagado = el sitio usa su diseño por defecto (violeta). Los colores que dejes «por defecto» no se tocan.</p></div>
      <div class="card"><h3>Color principal</h3><div class="colors">
        ${colorF('accent', 'Color de acento', c.accent, '#7C3AED')}${colorF('accentLight', 'Acento secundario', c.accentLight, '#8B5CF6')}</div>
        <div class="preview" id="prev"><h4>Ana Lucía García</h4><p>Así se ven tus títulos, textos y botones.</p><span class="pb">Escríbeme</span></div></div>
      <div class="card"><h3>Modo claro <small>fondos y textos</small></h3><div class="colors">
        ${colorF('bg', 'Fondo', c.bg, '#FAF9F7')}${colorF('bgCard', 'Tarjetas', c.bgCard, '#FFFFFF')}${colorF('bgSoft', 'Fondo suave', c.bgSoft, '#F3F0EB')}${colorF('text', 'Texto', c.text, '#1E1B18')}${colorF('text2', 'Texto secundario', c.text2, '#6B6560')}</div></div>
      <div class="card"><h3>Modo oscuro <small>fondos y textos</small></h3><div class="colors">
        ${colorF('dark.bg', 'Fondo', d.bg, '#070608')}${colorF('dark.bgCard', 'Tarjetas', d.bgCard, '#121015')}${colorF('dark.bgSoft', 'Fondo suave', d.bgSoft, '#1B1820')}${colorF('dark.text', 'Texto', d.text, '#F2EEF8')}${colorF('dark.text2', 'Texto secundario', d.text2, '#A9A2B8')}</div></div>
      <div class="card"><h3>Tipografía y bordes</h3><div class="row3">
        <div class="field"><label for="fD">Títulos</label>${sel('fD', FONTS_DISPLAY, f.display, 'Por defecto (Playfair)')}</div>
        <div class="field"><label for="fB">Texto</label>${sel('fB', FONTS_BODY, f.body, 'Por defecto (Inter)')}</div>
        <div class="field"><label for="rad">Bordes</label><select id="rad">${[['sharp', 'Rectos'], ['soft', 'Suaves (por defecto)'], ['round', 'Muy redondeados']].map(([v, l]) => `<option value="${v}" ${v === (t.radius || 'soft') ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <p class="hint" style="font-size:.82rem;color:var(--text-3)">Las fuentes se cargan desde Google Fonts solo si eliges una distinta a la de por defecto.</p></div>
      <div class="card"><h3>Estilo por sección <small>opcional</small></h3>
        ${SECTION_IDS.map(([id, l]) => { const s = secs[id] || {}; return `<details style="margin-bottom:.6rem" ${Object.keys(s).length ? 'open' : ''}><summary style="cursor:pointer;font-weight:600;padding:.3rem 0">${l}</summary><div class="colors" style="margin-top:.5rem">
          ${colorF(`sections.${id}.bg`, 'Fondo', s.bg, '#FAF9F7')}${colorF(`sections.${id}.text`, 'Texto', s.text, '#1E1B18')}${colorF(`sections.${id}.accent`, 'Acento', s.accent, '#7C3AED')}</div></details>`; }).join('')}</div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn danger" id="reset">Restablecer todo al diseño por defecto</button></div>
    </div>${saveBar()}`;
    const prev = () => {
      const g = p => { const n = $(`.color[data-path="${p}"] input`, el); return n?.dataset.set ? n.value : null; };
      const p = $('#prev', el); const acc = g('accent') || '#7C3AED', r = { sharp: '4px', soft: '14px', round: '26px' }[$('#rad', el).value];
      p.style.cssText = `background:${g('bgCard') || '#fff'};color:${g('text') || '#1E1B18'};border-radius:${r}`;
      $('.pb', p).style.cssText = `background:${acc}`; $('p', p).style.color = g('text2') || '#6B6560';
    };
    prev();
    el.addEventListener('input', e => {
      const col = e.target.closest('.color'); if (col && e.target.type === 'color') { e.target.dataset.set = '1'; col.classList.remove('unset'); $('small', col).textContent = e.target.value; }
      prev();
    });
    el.addEventListener('click', e => run(async () => {
      const x = e.target.closest('[data-clear]'); if (x) { const col = x.closest('.color'), i = $('input', col); delete i.dataset.set; col.classList.add('unset'); $('small', col).textContent = 'Por defecto'; return prev(); }
      if (e.target.closest('#reset')) {
        if (!await ask('Restablecer apariencia', 'Se quitarán todos tus colores, tipografías y estilos por sección. El sitio volverá al diseño por defecto.', 'Restablecer', true)) return;
        await saveSetting('theme', { customized: false, colors: {}, fonts: {}, radius: 'soft', sections: {} }); toast('Apariencia restablecida'); renderSite();
      }
    }));
    withSave($('#saveBtn', el), async () => {
      const theme = { customized: $('#custom', el).checked, colors: { dark: {} }, fonts: {}, radius: $('#rad', el).value, sections: {} };
      $$('.color', el).forEach(col => {
        const i = $('input', col); if (!i.dataset.set) return;
        const parts = col.dataset.path.split('.');
        if (parts[0] === 'dark') theme.colors.dark[parts[1]] = i.value;
        else if (parts[0] === 'sections') ((theme.sections[parts[1]] ||= {}))[parts[2]] = i.value;
        else theme.colors[parts[0]] = i.value;
      });
      if (!Object.keys(theme.colors.dark).length) delete theme.colors.dark;
      if ($('#fD', el).value) theme.fonts.display = $('#fD', el).value; if ($('#fB', el).value) theme.fonts.body = $('#fB', el).value;
      await saveSetting('theme', theme);
    });
  }

  function siteAccount(el) {
    el.innerHTML = `<div class="card"><h3>Cuenta</h3><p style="margin-bottom:1rem;color:var(--text-2)">Sesión iniciada como <b>${esc(S.user.email)}</b></p>
      <div id="pwMsg" class="msg" hidden></div>
      <div class="row2"><div class="field"><label for="np1">Nueva contraseña</label><input type="password" id="np1" autocomplete="new-password" minlength="8"><span class="hint">Mínimo 8 caracteres.</span></div>
        <div class="field"><label for="np2">Repite la contraseña</label><input type="password" id="np2" autocomplete="new-password"></div></div>
      <button class="btn primary" id="pwBtn">Cambiar contraseña</button></div>`;
    $('#pwBtn', el).onclick = () => run(async () => {
      const a = $('#np1', el).value, b = $('#np2', el).value, m = $('#pwMsg', el);
      const say = (t, c) => { m.hidden = false; m.className = 'msg ' + c; m.textContent = t; };
      if (a.length < 8) return say('La contraseña debe tener al menos 8 caracteres.', 'err');
      if (a !== b) return say('Las contraseñas no coinciden.', 'err');
      const { error } = await sb.auth.updateUser({ password: a }); if (error) return say(error.message, 'err');
      say('Contraseña actualizada.', 'ok'); $('#np1', el).value = $('#np2', el).value = '';
    });
  }

  /* ══ SESIÓN ══════════════════════════════════════════════════ */
  const show = id => { ['loginView', 'setupView', 'app'].forEach(v => $('#' + v).hidden = v !== id); };
  function loginMsg(t) { const m = $('#loginMsg'); m.hidden = !t; m.textContent = t || ''; }

  $('#lShow').onclick = () => { const i = $('#lPass'), on = i.type === 'password'; i.type = on ? 'text' : 'password'; $('#lShow use').setAttribute('href', on ? '#i-eye-off' : '#i-eye'); $('#lShow').setAttribute('data-tip', on ? 'Ocultar contraseña' : 'Mostrar contraseña'); };
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); loginMsg('');
    const email = $('#lEmail').value.trim(), pass = $('#lPass').value;
    if (!email || !pass) return loginMsg('Escribe tu correo y tu contraseña.');
    const b = $('#lBtn'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Entrando…';
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    b.disabled = false; b.textContent = 'Entrar';
    if (error) return loginMsg(/invalid/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message);
    $('#lPass').value = ''; await enter();
  });
  $('#logoutBtn').onclick = async () => { await sb.auth.signOut(); S.user = null; show('loginView'); };
  $('#themeBtn').onclick = () => {
    const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n; store.set('ag_theme', n); syncThemeIcon();
  };
  const syncThemeIcon = () => $('#themeBtn use').setAttribute('href', document.documentElement.dataset.theme === 'dark' ? '#i-sun' : '#i-moon');

  async function enter() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return show('loginView');
    S.user = session.user;
    const adm = await sb.from('admins').select('user_id').eq('user_id', S.user.id).maybeSingle();
    if (adm.error || !adm.data) {
      await sb.auth.signOut(); show('loginView');
      return loginMsg('Esta cuenta no tiene permisos de administración. Falta agregarla a la tabla «admins» (ver 01_schema.sql).');
    }
    $('#who').textContent = S.user.email;
    show('app'); progress('Cargando tu contenido…', 0.3);
    try { await loadAll(); } catch (e) { progress(null); return fail(e, 'No se pudo cargar'); }
    progress(null);
    go(VIEWS[store.get('ag_admin_view')] ? store.get('ag_admin_view') : 'home');
  }

  window.addEventListener('beforeunload', e => { if (S.busy) e.preventDefault(); });
  syncThemeIcon();
  (async function boot() {
    if (!HAS_SB) return show('setupView');
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON, { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') { S.user = null; show('loginView'); } });
    await enter();
  })();
})();
