/* ============================================================
   main.js  —  Portfolio Ana García  |  v2.0
   Carga el contenido desde Supabase en modo público.
   ============================================================ */

class Portfolio {
  constructor() {
    this.state = {
      loading        : true,
      section        : 'inicio',
      lightbox       : false,
      mockupsShown   : 0,
      batchSize      : 6,
      logoSlide      : 0,
      logosPerView   : this._logosPerView(),
      pdfViewers     : {},
      currentGuide   : 'egp',
      theme          : localStorage.getItem('ag_theme') || 'light',
      illusSlide     : 0,
    };

    // Datos de contenido (se sobreescriben desde Supabase si hay conexión)
    this.data = {
      mockups      : [],
      designs      : [],
      logos        : [],
      illustrations: [],
      featured     : [],
      pdfs         : [],
    };
  }

  // ── Inicio ─────────────────────────────────────────────────
  async init() {
    this._cache();
    this._applyTheme();
    this._bindEvents();
    this._startLoader();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._boot());
    } else {
      this._boot();
    }
  }

  async _boot() {
    await this._loadFromSupabase();
    this._updateYear();
    this._setupLazy();
    this._checkDarkPref();
  }

  // ── Cache DOM ───────────────────────────────────────────────
  _cache() {
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    this.el = {
      loadingScreen : $('loadingScreen'),
      loadingFill   : document.querySelector('.loading-fill'),
      loadingPct    : document.querySelector('.loading-percentage'),
      navbar        : $('navbar'),
      navMenu       : $('navMenu'),
      hamburger     : $('hamburger'),
      navLinks      : $$('.nav-link'),
      themeToggle   : $('themeToggle'),
      heroStats     : $$('.stat-number'),
      typewriter    : document.querySelector('.typewriter'),
      mockupsGrid   : $('mockupsGrid'),
      designsGrid   : $('designsGrid'),
      loadMoreBtn   : $('loadMoreMockups'),
      loadLessBtn   : $('loadLessMockups'),
      logosTrack    : $('logosTrack'),
      logosIndicators: $('logosIndicators'),
      logosPrev     : $('logosPrev'),
      logosNext     : $('logosNext'),
      logoModal     : $('logoVariationsModal'),
      modalClose    : $('modalClose'),
      modalOverlay  : $('modalOverlay'),
      guideTabs     : $$('.guide-tab'),
      contactForm   : $('contactForm'),
      lightbox      : $('lightbox'),
      lightboxImg   : $('lightboxImage'),
      lightboxTitle : document.querySelector('.lightbox-title'),
      lightboxDesc  : document.querySelector('.lightbox-description'),
      lightboxClose : $('lightboxClose'),
      lightboxOver  : $('lightboxOverlay'),
      backToTop     : $('backToTop'),
      sections      : $$('section[id]'),
    };
  }

  // ── Supabase ────────────────────────────────────────────────
  async _loadFromSupabase() {
    if (typeof getSB === 'undefined') return; // sin config

    try {
      const [mockups, designs, logos, illustrations, featured, pdfs] = await Promise.all([
        DB.getAll('mockups'),
        DB.getAll('designs'),
        DB.getAll('logos'),
        DB.getAll('illustrations'),
        DB.getAll('featured'),
        DB.getAll('pdfs'),
      ]);

      this.data = { mockups, designs, logos, illustrations, featured, pdfs };
    } catch (e) {
      console.warn('Supabase no disponible, usando datos locales.', e);
    }
  }

  // ── Loader ──────────────────────────────────────────────────
  _startLoader() {
    let p = 0;
    const tick = setInterval(() => {
      p += 2;
      if (this.el.loadingFill)  this.el.loadingFill.style.width = `${p}%`;
      if (this.el.loadingPct)   this.el.loadingPct.textContent  = `${p}%`;
      if (p >= 100) { clearInterval(tick); setTimeout(() => this._finishLoader(), 500); }
    }, 50);
  }

  _finishLoader() {
    this.el.loadingScreen?.classList.add('fade-out');
    setTimeout(() => {
      if (this.el.loadingScreen) this.el.loadingScreen.style.display = 'none';
      this.state.loading = false;
      this._startAnimations();
    }, 900);
  }

  // ── Animaciones iniciales ───────────────────────────────────
  _startAnimations() {
    this._animateStats();
    this._typewrite();
    this._intersectionObserver();
    this._renderMockups();
    this._renderDesigns();
    this._renderLogos();
    this._renderIllustrations();
    this._bindPortfolioViews();
    this._initPDF();
  }

  // ── Tema ────────────────────────────────────────────────────
  _applyTheme() { document.documentElement.setAttribute('data-theme', this.state.theme); }

  _toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('ag_theme', this.state.theme);
    this._applyTheme();
  }

  _checkDarkPref() {
    if (!localStorage.getItem('ag_theme') && window.matchMedia('(prefers-color-scheme:dark)').matches) {
      this.state.theme = 'dark';
      this._applyTheme();
    }
  }

  // ── Scroll ──────────────────────────────────────────────────
  _onScroll() {
    if (this.state.loading) return;
    requestAnimationFrame(() => {
      this._scrollProgress();
      this._navbarScroll();
      this._activeSection();
      this._toggleBackTop();
    });
  }

  _scrollProgress() {
    const pct = (window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    document.documentElement.style.setProperty('--scroll-progress', `${pct}%`);
  }

  _navbarScroll() {
    this.el.navbar?.classList.toggle('scrolled', window.pageYOffset > 90);
  }

  _activeSection() {
    const top = window.pageYOffset + 100;
    this.el.sections.forEach(sec => {
      if (top >= sec.offsetTop && top < sec.offsetTop + sec.offsetHeight) {
        this._setActiveLink(sec.id);
      }
    });
  }

  _setActiveLink(id) {
    if (this.state.section === id) return;
    this.state.section = id;
    this.el.navLinks.forEach(l => l.classList.toggle('active', l.dataset.section === id));
  }

  _toggleBackTop() {
    this.el.backToTop?.classList.toggle('visible', window.pageYOffset > 280);
  }

  // ── Navegación ──────────────────────────────────────────────
  _navClick(e) {
    e.preventDefault();
    const el = document.getElementById(e.currentTarget.dataset.section);
    if (el) window.scrollTo({ top: el.offsetTop - 75, behavior: 'smooth' });
    if (this.el.navMenu?.classList.contains('active')) this._toggleMobileMenu();
  }

  _toggleMobileMenu() {
    this.el.navMenu?.classList.toggle('active');
    this.el.hamburger?.classList.toggle('active');
    this.el.hamburger?.setAttribute('aria-expanded',
      this.el.hamburger.classList.contains('active') ? 'true' : 'false');
  }

  // ── Stats animados ──────────────────────────────────────────
  _animateStats() {
    this.el.heroStats.forEach((el, i) => {
      const target = parseInt(el.dataset.count);
      let cur = 0;
      const step = target / 50;
      setTimeout(() => {
        const t = setInterval(() => {
          cur += step;
          el.textContent = Math.floor(cur >= target ? (clearInterval(t), target) : cur);
        }, 50);
      }, i * 200);
    });
  }

  // ── Typewriter ──────────────────────────────────────────────
  _typewrite() {
    const el = this.el.typewriter;
    if (!el) return;
    const txt = el.textContent;
    el.textContent = '';
    let i = 0;
    setTimeout(() => {
      const t = setInterval(() => {
        el.textContent += txt[i++];
        if (i >= txt.length) { clearInterval(t); setTimeout(() => el.style.borderRight = 'none', 2000); }
      }, 90);
    }, 1200);
  }

  // ── Intersection observer ───────────────────────────────────
  _intersectionObserver() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('animated');
        const bar = entry.target.querySelector('.level-bar');
        if (bar) setTimeout(() => { bar.style.width = `${bar.dataset.level}%`; }, 300);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll(
      '.section-header,.about-content,.featured-item,.portfolio-item,.logo-item,.illustration-item,.contact-content,.tool-item'
    ).forEach(el => { el.classList.add('animate-on-scroll'); obs.observe(el); });
  }

  // ── Datos locales (imágenes ya existentes en la carpeta) ────
  // Edita estos arrays para que coincidan con tus archivos reales.
  // Los de Supabase se AGREGAN después de estos, no los reemplazan.
  _localData() {
    return {
      mockups: [
        { id:'l1', image_url:'imagenes/mockups/mockup1.jpg',  title:'Mockup 1',  category:'Presentación de Marca' },
        { id:'l2', image_url:'imagenes/mockups/mockup2.jpg',  title:'Mockup 2',  category:'Presentación de Marca' },
        { id:'l3', image_url:'imagenes/mockups/mockup3.jpg',  title:'Mockup 3',  category:'Presentación de Marca' },
        { id:'l4', image_url:'imagenes/mockups/mockup4.jpg',  title:'Mockup 4',  category:'Presentación de Marca' },
        { id:'l5', image_url:'imagenes/mockups/mockup5.jpg',  title:'Mockup 5',  category:'Presentación de Marca' },
        { id:'l6', image_url:'imagenes/mockups/mockup6.jpg',  title:'Mockup 6',  category:'Presentación de Marca' },
        { id:'l7', image_url:'imagenes/mockups/mockup7.jpg',  title:'Mockup 7',  category:'Presentación de Marca' },
        { id:'l8', image_url:'imagenes/mockups/mockup8.jpg',  title:'Mockup 8',  category:'Presentación de Marca' },
        { id:'l9', image_url:'imagenes/mockups/mockup9.jpg',  title:'Mockup 9',  category:'Presentación de Marca' },
        { id:'l10',image_url:'imagenes/mockups/mockup10.jpg', title:'Mockup 10', category:'Presentación de Marca' },
        { id:'l11',image_url:'imagenes/mockups/mockup11.jpg', title:'Mockup 11', category:'Presentación de Marca' },
        { id:'l12',image_url:'imagenes/mockups/mockup12.jpg', title:'Mockup 12', category:'Presentación de Marca' },
        { id:'l13',image_url:'imagenes/mockups/mockup13.jpg', title:'Mockup 13', category:'Presentación de Marca' },
        { id:'l14',image_url:'imagenes/mockups/mockup14.jpg', title:'Mockup 14', category:'Presentación de Marca' },
        { id:'l15',image_url:'imagenes/mockups/mockup15.jpg', title:'Mockup 15', category:'Presentación de Marca' },
      ],
      designs: [
        { id:'l1', image_url:'imagenes/diseños/diseño1.jpg',  title:'Diseño 1',  category:'Diseño Gráfico' },
        { id:'l2', image_url:'imagenes/diseños/diseño2.jpg',  title:'Diseño 2',  category:'Diseño Gráfico' },
        { id:'l3', image_url:'imagenes/diseños/diseño3.jpg',  title:'Diseño 3',  category:'Diseño Gráfico' },
        { id:'l4', image_url:'imagenes/diseños/diseño4.jpg',  title:'Diseño 4',  category:'Diseño Gráfico' },
        { id:'l5', image_url:'imagenes/diseños/diseño5.jpg',  title:'Diseño 5',  category:'Diseño Gráfico' },
        { id:'l6', image_url:'imagenes/diseños/diseño6.jpg',  title:'Diseño 6',  category:'Diseño Gráfico' },
        { id:'l7', image_url:'imagenes/diseños/diseño7.jpg',  title:'Diseño 7',  category:'Diseño Gráfico' },
        { id:'l8', image_url:'imagenes/diseños/diseño8.jpg',  title:'Diseño 8',  category:'Diseño Gráfico' },
        { id:'l9', image_url:'imagenes/diseños/diseño9.jpg',  title:'Diseño 9',  category:'Diseño Gráfico' },
        { id:'l10',image_url:'imagenes/diseños/diseño10.jpg', title:'Diseño 10', category:'Diseño Gráfico' },
        { id:'l11',image_url:'imagenes/diseños/diseño11.jpg', title:'Diseño 11', category:'Diseño Gráfico' },
        { id:'l12',image_url:'imagenes/diseños/diseño12.jpg', title:'Diseño 12', category:'Diseño Gráfico' },
      ],
      illustrations: [
        { id:'l1', image_url:'imagenes/ilustraciones/ilustracion1.png', title:'Ilustración 1', category:'Arte Digital' },
        { id:'l2', image_url:'imagenes/ilustraciones/ilustracion2.png', title:'Ilustración 2', category:'Arte Digital' },
        { id:'l3', image_url:'imagenes/ilustraciones/ilustracion3.png', title:'Ilustración 3', category:'Arte Digital' },
        { id:'l4', image_url:'imagenes/ilustraciones/ilustracion4.png', title:'Ilustración 4', category:'Arte Digital' },
        { id:'l5', image_url:'imagenes/ilustraciones/ilustracion5.png', title:'Ilustración 5', category:'Arte Digital' },
        { id:'l6', image_url:'imagenes/ilustraciones/ilustracion6.png', title:'Ilustración 6', category:'Arte Digital' },
        // Si tienes .jpg en vez de .png, cambia la extensión arriba
      ],
    };
  }

  // Combina imágenes locales + las subidas en Supabase (sin duplicar)
  _mergeItems(localItems, supabaseItems) {
    // Solo agregar de Supabase los que tengan image_url válida
    const sbValid = supabaseItems.filter(r => r.image_url && r.image_url.trim() !== '');
    return [...localItems, ...sbValid];
  }

  // ── Mockups ─────────────────────────────────────────────────
  _renderMockups(reset = true) {
    if (!this.el.mockupsGrid) return;
    if (reset) { this.el.mockupsGrid.innerHTML = ''; this.state.mockupsShown = 0; }

    const items = this._mergeItems(this._localData().mockups, this.data.mockups);
    if (items.length === 0) {
      if (this.el.loadMoreBtn) this.el.loadMoreBtn.style.display = 'none';
      if (this.el.loadLessBtn) this.el.loadLessBtn.style.display = 'none';
      return;
    }

    const end = Math.min(this.state.mockupsShown + this.state.batchSize, items.length);
    // Pasar la colección completa para navegación en lightbox
    const lbItems = items.map(i => ({ src: i.image_url, title: i.title, desc: i.category || '' }));

    for (let i = this.state.mockupsShown; i < end; i++) {
      const item = items[i];
      const card = this._portfolioCard(item, lbItems, i);
      this.el.mockupsGrid.insertAdjacentHTML('beforeend', card);
    }
    this.state.mockupsShown = end;

    if (this.el.loadMoreBtn) this.el.loadMoreBtn.style.display = end >= items.length ? 'none' : 'block';
    if (this.el.loadLessBtn) this.el.loadLessBtn.style.display = end <= this.state.batchSize ? 'none' : 'block';
  }

  _portfolioCard(item, lbItems = null, lbIdx = 0) {
    const safe = s => (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const url  = item.image_url || '';
    const tit  = safe(item.title || '');
    const cat  = safe(item.category || '');
    const errHandler = `this.closest('.portfolio-item').style.display='none'`;

    // Si hay colección completa, pasar JSON para navegación; si no, abrir solo esa imagen
    const onclickFn = lbItems
      ? `app.lightboxOpen('${url}','${tit}','${cat}',${JSON.stringify(lbItems).replace(/'/g, "\\'").replace(/"/g, '&quot;')},${lbIdx})`
      : `app.lightboxOpen('${url}','${tit}','${cat}')`;

    return `
    <div class="portfolio-item">
      <div class="portfolio-image">
        ${url ? `<img src="${url}" alt="${tit}" loading="lazy" onerror="${errHandler}">` : ''}
        <div class="portfolio-overlay">
          <div>
            <p class="portfolio-title">${item.title || ''}</p>
            <p class="portfolio-category">${item.category || ''}</p>
          </div>
          ${url ? `<button class="portfolio-view" onclick="${onclickFn}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }

  // ── Ilustraciones carousel ───────────────────────────────────
  _renderIllustrations() {
    const track = document.getElementById('illustrationsTrack');
    if (!track) return;

    const localIllus = this._localData().illustrations;
    const sbIllus    = this.data.illustrations.filter(r => r.image_url?.trim());
    const items      = [...localIllus, ...sbIllus];
    this._illus      = items;
    this.state.illusSlide = 0;

    const safe = s => (s || '').replace(/'/g, "\\'");

    track.innerHTML = items.map((item, idx) => {
      const url = item.image_url || '';
      const tit = safe(item.title || 'Ilustración');
      const cat = safe(item.category || '');
      return `
      <div class="illustration-item" data-idx="${idx}"
        onclick="app.lightboxOpen('${url}','${tit}','${cat}')">
        <div class="illustration-container">
          <img src="${url}" alt="${tit}" loading="lazy"
            onerror="app._illusImgError(this)">
          <div class="illustration-overlay">
            <div class="illustration-info">
              <h3 class="illustration-title">${item.title || 'Ilustración'}</h3>
              <p class="illustration-style">${item.category || ''}</p>
            </div>
            <span class="illustration-view-hint">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
            </span>
          </div>
        </div>
      </div>`;
    }).join('');

    // Esperar un tick para que las imágenes que sí existen carguen
    // y las que no disparen onerror, luego recalcular
    setTimeout(() => {
      const visible = track.querySelectorAll('.illustration-item').length;
      this._illus = Array(visible).fill({});
      this._renderIllusIndicators();
      this._updateIllusCarousel();
    }, 600);

    // Botones prev/next — clonar para evitar duplicar listeners
    ['illusPrev','illusNext'].forEach(id => {
      const old = document.getElementById(id);
      if (!old) return;
      const fresh = old.cloneNode(true);
      old.parentNode.replaceChild(fresh, old);
    });
    document.getElementById('illusPrev')?.addEventListener('click', () => {
      if (this.state.illusSlide > 0) { this.state.illusSlide--; this._updateIllusCarousel(); }
    });
    document.getElementById('illusNext')?.addEventListener('click', () => {
      const count = document.querySelectorAll('#illustrationsTrack .illustration-item').length;
      const max   = Math.ceil(count / this._illusPerView());
      if (this.state.illusSlide < max - 1) { this.state.illusSlide++; this._updateIllusCarousel(); }
    });
  }

  // Llamado por onerror de imagen de ilustración
  _illusImgError(img) {
    img.closest('.illustration-item')?.remove();
    clearTimeout(this._illusErrTimer);
    this._illusErrTimer = setTimeout(() => {
      const count = document.querySelectorAll('#illustrationsTrack .illustration-item').length;
      this._illus = Array(count).fill({});
      this._renderIllusIndicators();
      this._updateIllusCarousel();
    }, 150);
  }

  _illusPerView() { return window.innerWidth <= 768 ? 1 : window.innerWidth <= 1024 ? 2 : 3; }

  _illusCount() {
    return document.querySelectorAll('#illustrationsTrack .illustration-item').length;
  }

  _renderIllusIndicators() {
    const el = document.getElementById('illusIndicators');
    if (!el) return;
    const count  = this._illusCount();
    const slides = Math.ceil(count / this._illusPerView());
    el.innerHTML = Array.from({ length: slides }, (_, i) =>
      `<button class="indicator${i === 0 ? ' active' : ''}" onclick="app._goIllusSlide(${i})"></button>`
    ).join('');
  }

  _updateIllusCarousel() {
    const track    = document.getElementById('illustrationsTrack');
    const viewport = track?.parentElement;
    if (!track || !viewport) return;

    const perView = this._illusPerView();
    const vw      = viewport.clientWidth;
    const gap     = perView === 1 ? 0 : 28;
    const itemW   = perView === 1 ? vw : 300 + gap;
    const offset  = this.state.illusSlide * perView * itemW;
    track.style.transform = `translateX(-${offset}px)`;

    const max  = Math.ceil(this._illusCount() / perView);
    const prev = document.getElementById('illusPrev');
    const next = document.getElementById('illusNext');
    if (prev) prev.disabled = this.state.illusSlide === 0;
    if (next) next.disabled = this.state.illusSlide >= max - 1;
    document.querySelectorAll('#illusIndicators .indicator')
      .forEach((ind, i) => ind.classList.toggle('active', i === this.state.illusSlide));
  }

  _goIllusSlide(i) { this.state.illusSlide = i; this._updateIllusCarousel(); }

  // ── Diseños ─────────────────────────────────────────────────
  _renderDesigns(reset = false) {
    if (!this.el.designsGrid) return;
    if (reset) this.el.designsGrid.innerHTML = '';
    if (this.el.designsGrid.children.length && !reset) return;

    const items = this._mergeItems(this._localData().designs, this.data.designs);
    items.forEach(item => {
      this.el.designsGrid.insertAdjacentHTML('beforeend', this._portfolioCard(item));
    });
  }

  // ── Logos carousel ──────────────────────────────────────────
  _renderLogos() {
    if (!this.el.logosTrack) return;

    // Logos locales base
    const localLogos = [
      { id:'l1', name:'Energi',            description:'Identidad Corporativa', main_image:'imagenes/logos/logo1.png',
        variations:[{name:'Verde',image:'imagenes/logos/logo1.png'},{name:'Azul',image:'imagenes/Variaciones_logos/logo1_azul.png'},{name:'Negro',image:'imagenes/Variaciones_logos/logo1_negro.png'}]},
      { id:'l2', name:'North Energy Corp', description:'Logo Corporativo',      main_image:'imagenes/logos/logo2.png',
        variations:[{name:'Azul',image:'imagenes/logos/logo2.png'},{name:'Negro',image:'imagenes/Variaciones_logos/logo2_negro.png'}]},
      { id:'l3', name:'Grin Network',      description:'Tecnología Verde',      main_image:'imagenes/logos/logo3.png',
        variations:[{name:'Verde',image:'imagenes/logos/logo3.png'}]},
      { id:'l4', name:'Logo 4',            description:'Marca Comercial',       main_image:'imagenes/logos/logo4.png', variations:[{name:'Original',image:'imagenes/logos/logo4.png'}]},
      { id:'l5', name:'Logo 5',            description:'Identidad Visual',      main_image:'imagenes/logos/logo5.png', variations:[{name:'Original',image:'imagenes/logos/logo5.png'}]},
    ];

    // Supabase: solo los que tengan main_image válida
    const sbLogos = this.data.logos.filter(l => l.main_image && l.main_image.trim() !== '');

    const logos = [...localLogos, ...sbLogos];
    this._logos = logos;

    this.el.logosTrack.innerHTML = logos.map((l, idx) => `
      <div class="logo-item" data-idx="${idx}">
        <div class="logo-container">
          <img src="${l.main_image}" alt="${l.name}" loading="lazy"
            onerror="this.closest('.logo-item').style.display='none'">
          <div class="logo-overlay">
            <h3 class="logo-title">${l.name}</h3>
            <p class="logo-description">${l.description}</p>
            <p class="logo-variations-count">${l.variations?.length || 1} variacion${(l.variations?.length || 1) !== 1 ? 'es' : ''}</p>
            <button class="view-variations-btn" onclick="app.openLogoVariations(${idx})">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/></svg>
              Ver Variaciones
            </button>
          </div>
        </div>
      </div>`).join('');

    this._renderLogoIndicators();
    this._updateCarousel();
  }

  _renderLogoIndicators() {
    if (!this.el.logosIndicators) return;
    const slides = Math.ceil((this._logos?.length || 0) / this.state.logosPerView);
    this.el.logosIndicators.innerHTML = Array.from({ length: slides }, (_, i) =>
      `<button class="indicator${i === 0 ? ' active' : ''}" onclick="app._goSlide(${i})"></button>`
    ).join('');
  }

  _updateCarousel() {
    const track    = this.el.logosTrack;
    const viewport = this.el.logosTrack?.parentElement;
    if (!track || !viewport) return;

    const perView  = this.state.logosPerView;
    // Usar el ancho real del viewport para calcular el offset
    const vw       = viewport.clientWidth;
    const gap      = perView === 1 ? 0 : 28;
    const itemW    = perView === 1 ? vw : 300 + gap;
    const offset   = this.state.logoSlide * perView * itemW;
    track.style.transform = `translateX(-${offset}px)`;

    const max = Math.ceil((this._logos?.length || 0) / perView);
    if (this.el.logosPrev) this.el.logosPrev.disabled = this.state.logoSlide === 0;
    if (this.el.logosNext) this.el.logosNext.disabled = this.state.logoSlide >= max - 1;
    document.querySelectorAll('#logosIndicators .indicator, .logos-carousel-container .indicator')
      .forEach((ind, i) => ind.classList.toggle('active', i === this.state.logoSlide));
  }

  _goSlide(i) { this.state.logoSlide = i; this._updateCarousel(); }

  // ── Logo variaciones ────────────────────────────────────────
  openLogoVariations(idx) {
    const logo = this._logos?.[idx];
    if (!logo) return;

    document.getElementById('modalLogoTitle').textContent = `Variaciones — ${logo.name}`;
    const grid = document.getElementById('variationsGrid');

    const vars = logo.variations?.length
      ? logo.variations
      : [{ name:'Original', image: logo.main_image }];

    grid.innerHTML = vars.map(v => `
      <div class="variation-item">
        <div class="variation-img-wrap">
          <img src="${v.image}" alt="${v.name}" loading="lazy"
            onerror="this.closest('.variation-item').style.display='none'">
        </div>
        <div class="variation-label">${v.name}</div>
      </div>`).join('');

    this.el.logoModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  _closeLogoModal() { this.el.logoModal?.classList.remove('active'); document.body.style.overflow = ''; }

  // ── Lightbox ────────────────────────────────────────────────
  lightboxOpen(src, title = '', desc = '', items = null, idx = 0) {
    if (this.el.lightboxImg)   this.el.lightboxImg.src          = src;
    if (this.el.lightboxTitle) this.el.lightboxTitle.textContent = title;
    if (this.el.lightboxDesc)  this.el.lightboxDesc.textContent  = desc;

    // Guardar colección para navegar prev/next
    this._lbItems = items || [{ src, title, desc }];
    this._lbIdx   = idx;
    this._updateLightboxNav();

    this.el.lightbox?.classList.add('active');
    this.state.lightbox = true;
    document.body.style.overflow = 'hidden';
  }

  _updateLightboxNav() {
    const total   = this._lbItems?.length || 1;
    const cur     = (this._lbIdx || 0) + 1;
    const counter = document.querySelector('.lightbox-counter');
    if (counter) counter.textContent = total > 1 ? `${cur} / ${total}` : '';
    const prev = document.querySelector('.lightbox-prev');
    const next = document.querySelector('.lightbox-next');
    if (prev) prev.style.display = total > 1 ? 'flex' : 'none';
    if (next) next.style.display = total > 1 ? 'flex' : 'none';
  }

  _lbNavigate(dir) {
    if (!this._lbItems?.length) return;
    this._lbIdx = (this._lbIdx + dir + this._lbItems.length) % this._lbItems.length;
    const item = this._lbItems[this._lbIdx];
    if (this.el.lightboxImg)   this.el.lightboxImg.src          = item.src   || item.image_url || '';
    if (this.el.lightboxTitle) this.el.lightboxTitle.textContent = item.title || '';
    if (this.el.lightboxDesc)  this.el.lightboxDesc.textContent  = item.desc  || item.category || '';
    this._updateLightboxNav();
  }

  _closeLightbox() { this.el.lightbox?.classList.remove('active'); this.state.lightbox = false; document.body.style.overflow = ''; }

  // ── PDF ─────────────────────────────────────────────────────
  _initPDF() {
    if (typeof pdfjsLib === 'undefined') return;
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // PDFs locales (siempre presentes)
    const localPDFs = [
      { slug:'egp', name:'Manual EGP', url:'Manual de Marca EGP.pdf',
        client:'EGP Company', year:'2025',
        description:'Guía visual completa que establece las bases de la identidad corporativa, tipografías, colores, aplicaciones y usos correctos de la marca.' },
      { slug:'eai', name:'Manual EAI', url:'Manual de Marca EAI.pdf',
        client:'EAI Solutions', year:'2025',
        description:'Manual especializado en aplicaciones específicas de la identidad visual, con enfoque en implementación digital y medios de comunicación.' },
    ];

    // PDFs de Supabase — solo los que tengan URL válida y slug distinto a los locales
    const localSlugs = new Set(localPDFs.map(p => p.slug));
    const sbPDFs = this.data.pdfs.filter(p => p.url?.trim() && !localSlugs.has(p.slug));

    // Siempre: locales primero, nuevos de Supabase al final
    const pdfs = [...localPDFs, ...sbPDFs];

    if (!pdfs.length) return;
    this._buildPDFViewer(pdfs);
  }

  _buildPDFViewer(pdfs) {
    const tabsEl   = document.querySelector('.guides-tabs');
    const viewerEl = document.querySelector('.guides-viewer');
    if (!tabsEl || !viewerEl) return;

    // Generar tabs
    tabsEl.innerHTML = pdfs.map((p, i) => `
      <button class="guide-tab${i === 0 ? ' active' : ''}"
        data-guide="${p.slug}" role="tab" aria-selected="${i === 0}">
        <div class="tab-icon">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>
        </div>
        <div class="tab-content">
          <h3>${p.name}</h3>
          <p>${p.description ? p.description.substring(0, 40) + '…' : 'Manual de marca'}</p>
        </div>
      </button>`).join('');

    // Generar paneles
    viewerEl.innerHTML = pdfs.map((p, i) => `
      <div class="guide-panel${i === 0 ? ' active' : ''}" id="guide-${p.slug}" role="tabpanel">
        <div class="guide-info">
          <h3 class="guide-title">${p.name}</h3>
          <p class="guide-description">${p.description || ''}</p>
          <div class="guide-specs">
            <div class="spec-item"><span class="spec-label">Cliente</span><span class="spec-value">${p.client || '—'}</span></div>
            <div class="spec-item"><span class="spec-label">Año</span><span class="spec-value">${p.year || '—'}</span></div>
            <div class="spec-item"><span class="spec-label">Páginas</span><span class="spec-value" id="pdf-pages-${p.slug}">—</span></div>
          </div>
          <button class="btn-download" onclick="downloadPDF('${p.url}')">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/></svg>
            Descargar PDF
          </button>
        </div>
        <div class="guide-preview">
          <div class="pdf-viewer" id="pdf-${p.slug}">
            <div class="pdf-controls">
              <button class="pdf-btn" id="prevPage-${p.slug}">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/></svg>
              </button>
              <div class="pdf-info">
                <span id="pageNum-${p.slug}">1</span>/<span id="pageCount-${p.slug}">—</span>
              </div>
              <button class="pdf-btn" id="nextPage-${p.slug}">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg>
              </button>
              <div class="pdf-zoom">
                <button class="pdf-btn" id="zoomOut-${p.slug}">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19,13H5V11H19V13Z"/></svg>
                </button>
                <span class="zoom-level" id="zoomLevel-${p.slug}">100%</span>
                <button class="pdf-btn" id="zoomIn-${p.slug}">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
                </button>
              </div>
            </div>
            <div class="pdf-canvas-container">
              <canvas id="pdf-canvas-${p.slug}"></canvas>
              <div class="pdf-loading"><div class="loading-spinner"></div><p>Cargando PDF…</p></div>
            </div>
          </div>
        </div>
      </div>`).join('');

    // Rebind tabs
    document.querySelectorAll('.guide-tab').forEach(t =>
      t.addEventListener('click', e => this._switchGuide(e))
    );

    // Cargar solo el primer PDF activo inmediatamente; los demás al hacer clic en su tab
    this._loadPDF(pdfs[0].slug, pdfs[0].url);
    this._pdfLoadedSlugs = new Set([pdfs[0].slug]);
    this._allPDFs = pdfs;
  }

  async _loadPDF(id, url) {
    try {
      const pdf = await pdfjsLib.getDocument(url).promise;
      this.state.pdfViewers[id] = { pdf, page: 1, total: pdf.numPages, scale: 1 };
      this._renderPDFPage(id, 1);
      this._pdfControls(id);
      document.querySelector(`#pdf-${id} .pdf-loading`)?.remove();
      // Actualizar páginas en el panel info
      const pagesEl = document.getElementById(`pdf-pages-${id}`);
      if (pagesEl) pagesEl.textContent = `${pdf.numPages} páginas`;
    } catch (e) {
      console.warn(`PDF ${id} no disponible.`, e);
      const loading = document.querySelector(`#pdf-${id} .pdf-loading`);
      if (loading) loading.innerHTML = '<p style="color:var(--text-3);font-size:.85rem">PDF no disponible</p>';
    }
  }

  async _renderPDFPage(id, num) {
    const v = this.state.pdfViewers[id];
    if (!v) return;

    const page = await v.pdf.getPage(num);

    // Calcular escala para que quepa en el contenedor sin scroll horizontal
    const container = document.querySelector(`#pdf-${id} .pdf-canvas-container`);
    const maxWidth  = container ? container.clientWidth - 32 : 700; // 16px padding c/lado
    const rawVP     = page.getViewport({ scale: 1 });
    const fitScale  = Math.min(maxWidth / rawVP.width, v.scale * (maxWidth / rawVP.width));
    // Si el usuario no ha hecho zoom, ajustar al ancho; si hizo zoom, respetar su escala
    const autoScale = v.userScaled ? v.scale : (maxWidth / rawVP.width);
    const vp        = page.getViewport({ scale: autoScale });

    const canvas  = document.getElementById(`pdf-canvas-${id}`);
    if (!canvas) return;
    canvas.height = vp.height;
    canvas.width  = vp.width;
    canvas.style.width  = '100%';
    canvas.style.height = 'auto';

    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    v.page  = num;
    v.scale = autoScale;
    this._pdfInfo(id);
  }

  _pdfInfo(id) {
    const v = this.state.pdfViewers[id];
    if (!v) return;
    const set = (sel, val) => { const el = document.getElementById(sel); if (el) el.textContent = val; };
    set(`pageNum-${id}`,   v.page);
    set(`pageCount-${id}`, v.total);
    set(`zoomLevel-${id}`, `${Math.round(v.scale * 100)}%`);
  }

  _pdfControls(id) {
    const btn = (sel, fn) => { const el = document.getElementById(sel); if (el) el.onclick = fn; };
    const v   = () => this.state.pdfViewers[id];
    btn(`prevPage-${id}`, () => { if (v().page > 1)       this._renderPDFPage(id, v().page - 1); });
    btn(`nextPage-${id}`, () => { if (v().page < v().total) this._renderPDFPage(id, v().page + 1); });
    btn(`zoomIn-${id}`,  () => {
      const viewer = v();
      viewer.scale      = (viewer.scale || 1) + 0.2;
      viewer.userScaled = true;
      this._renderPDFPage(id, viewer.page);
    });
    btn(`zoomOut-${id}`, () => {
      const viewer = v();
      if ((viewer.scale || 1) > 0.4) {
        viewer.scale      = (viewer.scale || 1) - 0.2;
        viewer.userScaled = true;
        this._renderPDFPage(id, viewer.page);
      }
    });
  }

  // ── Guías tabs ──────────────────────────────────────────────
  _switchGuide(e) {
    const id = e.currentTarget.dataset.guide;
    document.querySelectorAll('.guide-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    e.currentTarget.classList.add('active');
    e.currentTarget.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.guide-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`guide-${id}`)?.classList.add('active');
    this.state.currentGuide = id;

    // Cargar el PDF de este tab si aún no se ha cargado
    if (this._allPDFs && this._pdfLoadedSlugs && !this._pdfLoadedSlugs.has(id)) {
      const pdfData = this._allPDFs.find(p => p.slug === id);
      if (pdfData) {
        this._loadPDF(id, pdfData.url);
        this._pdfLoadedSlugs.add(id);
      }
    }
  }

  // ── Formulario contacto ─────────────────────────────────────
  _submitForm(e) {
    e.preventDefault();
    if (!this._validateForm()) return;

    const fd = new FormData(this.el.contactForm);
    const msg = `🎨 *PORTFOLIO — NUEVO CONTACTO*\n\n👤 ${fd.get('name')}\n📧 ${fd.get('email')}\n📱 ${fd.get('phone') || '—'}\n🎯 ${fd.get('service')}\n💰 ${fd.get('budget') || '—'}\n\n💬 ${fd.get('message')}`;
    window.open(`https://wa.me/51977575523?text=${encodeURIComponent(msg)}`, '_blank');

    this._notify('Mensaje enviado correctamente', 'success');
    setTimeout(() => { this.el.contactForm?.reset(); this._clearErrors(); }, 2000);
  }

  _validateForm() {
    this._clearErrors();
    let ok = true;
    ['name','email','service','message'].forEach(f => {
      const el = this.el.contactForm?.querySelector(`[name="${f}"]`);
      if (!el?.value.trim()) { this._fieldError(el, 'Este campo es requerido'); ok = false; }
    });
    const email = this.el.contactForm?.querySelector('[name="email"]');
    if (email?.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      this._fieldError(email, 'Email no válido'); ok = false;
    }
    return ok;
  }

  _fieldError(el, msg) {
    const g = el?.closest('.form-group');
    if (!g) return;
    g.classList.add('error');
    const err = g.querySelector('.form-error');
    if (err) err.textContent = msg;
  }

  _clearErrors() {
    this.el.contactForm?.querySelectorAll('.form-group').forEach(g => {
      g.classList.remove('error');
      const e = g.querySelector('.form-error');
      if (e) e.textContent = '';
    });
  }

  // ── Notificación ────────────────────────────────────────────
  _notify(msg, type = 'success') {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => { n.style.animation = 'notifOut .4s ease'; setTimeout(() => n.remove(), 400); }, 3000);
  }

  // ── Bind events ─────────────────────────────────────────────
  _bindPortfolioViews() {
    document.querySelectorAll('[data-lightbox]').forEach(btn => {
      const art = btn.closest('article,[class*=item]');
      const img = art?.querySelector('img');
      const tit = art?.querySelector('[class*=title]');
      const dsc = art?.querySelector('[class*=description],[class*=category],[class*=style]');
      if (img) btn.addEventListener('click', () => this.lightboxOpen(img.src, tit?.textContent, dsc?.textContent));
    });
  }

  _bindEvents() {
    window.addEventListener('scroll',  this._throttle(() => this._onScroll(), 16));
    window.addEventListener('resize',  this._debounce(() => this._onResize(), 250));
    document.addEventListener('keydown', e => this._onKey(e));

    // Recargar datos cuando el usuario vuelve a la pestaña (p.ej. desde el admin)
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && !this.state.loading) {
        await this._loadFromSupabase();
        this._renderMockups(true);
        this._renderDesigns(true);
        this._renderIllustrations();
        this._renderLogos();
      }
    });

    this.el.hamburger?.addEventListener('click',  () => this._toggleMobileMenu());
    this.el.themeToggle?.addEventListener('click', () => this._toggleTheme());
    this.el.navLinks.forEach(l => l.addEventListener('click', e => this._navClick(e)));

    this.el.lightboxClose?.addEventListener('click', () => this._closeLightbox());
    this.el.lightboxOver?.addEventListener('click',  () => this._closeLightbox());
    document.querySelector('.lightbox-prev')?.addEventListener('click', () => this._lbNavigate(-1));
    document.querySelector('.lightbox-next')?.addEventListener('click', () => this._lbNavigate(1));

    this.el.guideTabs.forEach(t => t.addEventListener('click', e => this._switchGuide(e)));
    this.el.contactForm?.addEventListener('submit', e => this._submitForm(e));
    this.el.backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    this.el.loadMoreBtn?.addEventListener('click', () => {
      this.el.loadMoreBtn.textContent = 'Cargando...';
      setTimeout(() => { this._renderMockups(false); this.el.loadMoreBtn.textContent = 'Cargar Más'; }, 400);
    });
    this.el.loadLessBtn?.addEventListener('click', () => {
      const items = this.el.mockupsGrid?.querySelectorAll('.portfolio-item');
      const remove = Math.min(this.state.batchSize, (items?.length || 0) - this.state.batchSize);
      for (let i = 0; i < remove; i++) this.el.mockupsGrid?.lastElementChild?.remove();
      this.state.mockupsShown -= remove;
      if (this.el.loadMoreBtn) this.el.loadMoreBtn.style.display = 'block';
      if (this.el.loadLessBtn) this.el.loadLessBtn.style.display = this.state.mockupsShown <= this.state.batchSize ? 'none' : 'block';
    });

    this.el.logosPrev?.addEventListener('click', () => { if (this.state.logoSlide > 0) { this.state.logoSlide--; this._updateCarousel(); } });
    this.el.logosNext?.addEventListener('click', () => {
      const max = Math.ceil((this._logos?.length || 0) / this.state.logosPerView);
      if (this.state.logoSlide < max - 1) { this.state.logoSlide++; this._updateCarousel(); }
    });

    this.el.modalClose?.addEventListener('click',   () => this._closeLogoModal());
    this.el.modalOverlay?.addEventListener('click', () => this._closeLogoModal());
  }

  _onKey(e) {
    if (e.key === 'Escape') {
      if (this.state.lightbox) this._closeLightbox();
      if (this.el.logoModal?.classList.contains('active')) this._closeLogoModal();
    }
    if (this.state.lightbox) {
      if (e.key === 'ArrowLeft')  this._lbNavigate(-1);
      if (e.key === 'ArrowRight') this._lbNavigate(1);
    }
    if (e.target.closest('.pdf-viewer')) {
      const id = e.target.closest('.pdf-viewer')?.id?.includes('egp') ? 'egp' : 'eai';
      const v  = this.state.pdfViewers[id];
      if (!v) return;
      if (e.key === 'ArrowLeft'  && v.page > 1)       this._renderPDFPage(id, v.page - 1);
      if (e.key === 'ArrowRight' && v.page < v.total) this._renderPDFPage(id, v.page + 1);
    }
  }

  _onResize() {
    const n = this._logosPerView();
    if (n !== this.state.logosPerView) {
      this.state.logosPerView = n;
      this.state.logoSlide = 0;
      this._renderLogoIndicators();
      this._updateCarousel();
    }
    // Resetear carousel de ilustraciones también
    this.state.illusSlide = 0;
    this._renderIllusIndicators();
    this._updateIllusCarousel();
  }

  // ── Helpers ─────────────────────────────────────────────────
  _logosPerView() { return window.innerWidth <= 768 ? 1 : window.innerWidth <= 1024 ? 2 : 3; }

  _updateYear() {
    const el = document.getElementById('currentYear');
    if (el) el.textContent = new Date().getFullYear();
  }

  _setupLazy() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const img = e.target;
        if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
        img.classList.add('loaded');
        obs.unobserve(img);
      });
    });
    document.querySelectorAll('img[loading="lazy"]').forEach(img => obs.observe(img));
  }

  _throttle(fn, ms) {
    let lock = false;
    return (...a) => { if (!lock) { fn(...a); lock = true; setTimeout(() => lock = false, ms); } };
  }

  _debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
}

// ── Global helpers ──────────────────────────────────────────
function downloadPDF(filename) {
  const a = Object.assign(document.createElement('a'), { href: filename, download: filename });
  a.click();
}

// ── Arranque ────────────────────────────────────────────────
const app = new Portfolio();
document.addEventListener('DOMContentLoaded', () => app.init());

// Fallback si el DOM ya estaba listo
if (document.readyState !== 'loading') app.init();

// Compatibilidad con llamadas antiguas (por si quedan en el HTML)
window.portfolioApp = { openLightbox: (...a) => app.lightboxOpen(...a) };
