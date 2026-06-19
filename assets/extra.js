/* ============================================================
   MOOC — UX/UI optimized JavaScript (Coursera-style)
   Features:
   - Quiz with inline feedback + retry + scoring
   - Flashcards (event-delegated flip)
   - Slide carousel + lightbox
   - Per-activity completion tracking (Coursera-like)
   - Module completion (auto + manual)
   - Sidebar nav: green check per attività completata
   - Reading time estimation
   - Prev/next module navigation
   ============================================================ */

(function () {
  const STORAGE_KEY = 'mooc_progress_v2';

  // Mapping fra slug della pagina e slug del modulo (dal path)
  function currentModuleSlug() {
    const path = location.pathname.replace(/\/$/, '');
    const m = path.match(/\/(\d{2}-[^/]+)\//);
    if (m) return m[1];
    // fallback: header data-modulo
    const header = document.querySelector('.course-page-header[data-modulo]');
    return header ? header.getAttribute('data-modulo') : null;
  }

  function getProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function setItemCompleted(moduleSlug, itemId) {
    if (!moduleSlug || !itemId) return;
    const p = getProgress();
    p[moduleSlug] = p[moduleSlug] || { items: {} };
    p[moduleSlug].items = p[moduleSlug].items || {};
    if (p[moduleSlug].items[itemId]) return;  // già fatto
    p[moduleSlug].items[itemId] = { done: true, ts: Date.now() };
    saveProgress(p);
    refreshSidebar();
    refreshModuleCompletion(moduleSlug);
  }
  function setModuleCompleted(slug, done) {
    const p = getProgress();
    p[slug] = p[slug] || { items: {} };
    p[slug].completed = !!done;
    p[slug].ts = Date.now();
    saveProgress(p);
    refreshSidebar();
  }
  function getModuleItems(slug) {
    const p = getProgress();
    return (p[slug] && p[slug].items) || {};
  }

  // ============ SIDEBAR: custom collassabile + green check ============
  const KNOWN_ITEM_ANCHORS = [
    'ascoltare-podcast',
    'guardare-slide',
    'leggere-dispensa',
    'verificare-quiz',
    'ripassare-flashcard',
    'consultare-glossario',
    'scaricare-risorse',
  ];

  // Costruisce la sidebar custom basata su window.MOOC_MANIFEST
  function buildCustomSidebar() {
    const manifest = window.MOOC_MANIFEST;
    if (!manifest || !manifest.modules) return;
    const nav = document.querySelector('.md-sidebar--primary nav.md-nav--primary > ul.md-nav__list');
    if (!nav) return;
    if (nav.__moocBuilt) return;
    nav.__moocBuilt = true;

    // Calcola path-prefix relativo alla root del sito (gestisce file:// e http://)
    // Esempio: se sono in 01-modulo/index.html, root è '../'
    const path = location.pathname;
    let prefix = '';
    const depth = path.split('/').slice(0, -1).filter(p => p && p !== '/').length;
    if (path.includes('/01-') || path.includes('/02-') || path.includes('/03-') || path.includes('/04-') || path.includes('/05-')
        || /\/[0-9]{2}-/.test(path)) {
      prefix = '../';
    }

    const curSlug = currentModuleSlug();
    const progress = getProgress();

    // Pulisci nav esistente
    nav.innerHTML = '';

    // Helper: crea voce link top-level
    function topItem(label, href, extras = {}) {
      const li = document.createElement('li');
      li.className = 'md-nav__item';
      const a = document.createElement('a');
      a.className = 'md-nav__link';
      a.href = href;
      const span = document.createElement('span');
      span.className = 'md-ellipsis';
      span.textContent = label;
      a.appendChild(span);
      Object.entries(extras).forEach(([k, v]) => a.setAttribute(k, v));
      li.appendChild(a);
      return li;
    }

    // Home
    nav.appendChild(topItem('Home', prefix + 'index.html', {'data-mooc-skip': 'true'}));

    // Moduli
    manifest.modules.forEach((mod, idx) => {
      const isCurrent = mod.slug === curSlug;
      const modProg = progress[mod.slug] || {};
      const modCompleted = !!modProg.completed;
      const itemsDone = modProg.items || {};

      const li = document.createElement('li');
      li.className = 'md-nav__item mooc-module-item' + (isCurrent ? ' mooc-current' : '') + (isCurrent ? ' expanded' : '');

      // Riga modulo (cliccabile per espandere + freccia)
      const row = document.createElement('div');
      row.className = 'mooc-mod-row';

      // Link al modulo
      const a = document.createElement('a');
      a.className = 'md-nav__link mooc-mod-link';
      a.href = prefix + mod.slug + '/index.html';
      if (modCompleted) a.setAttribute('data-mooc-completed', 'true');

      const eyebrow = document.createElement('span');
      eyebrow.className = 'mooc-mod-eyebrow';
      eyebrow.textContent = 'Modulo ' + (idx + 1);

      const title = document.createElement('span');
      title.className = 'mooc-mod-title';
      // Strip "Modulo N — " dal titolo se presente
      const cleanTitle = mod.title.replace(/^Modulo\s+\d+\s*[-—–:]\s*/, '');
      title.textContent = cleanTitle;

      a.appendChild(eyebrow);
      a.appendChild(title);
      row.appendChild(a);

      // Chevron toggle
      const toggle = document.createElement('button');
      toggle.className = 'mooc-mod-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-label', 'Espandi/comprimi modulo');
      toggle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>';
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        li.classList.toggle('expanded');
      });
      row.appendChild(toggle);

      li.appendChild(row);

      // Sub-items (attività)
      const sub = document.createElement('ul');
      sub.className = 'md-nav__list mooc-mod-items';
      mod.items.forEach(item => {
        const subLi = document.createElement('li');
        subLi.className = 'md-nav__item mooc-item';
        const subA = document.createElement('a');
        subA.className = 'md-nav__link mooc-item-link';
        subA.href = prefix + mod.slug + '/index.html#' + item.id;
        subA.setAttribute('data-mooc-item', 'true');
        if (itemsDone[item.id]) subA.setAttribute('data-mooc-item-completed', 'true');
        const subSpan = document.createElement('span');
        subSpan.className = 'md-ellipsis';
        subSpan.textContent = item.label;
        subA.appendChild(subSpan);
        subLi.appendChild(subA);
        sub.appendChild(subLi);
      });
      li.appendChild(sub);

      nav.appendChild(li);
    });

    // Bibliografia & Informazioni
    if (manifest.hasBibliografia) {
      nav.appendChild(topItem('Bibliografia', prefix + 'bibliografia.html', {'data-mooc-skip': 'true'}));
    }
    nav.appendChild(topItem('Informazioni', prefix + 'about.html', {'data-mooc-skip': 'true'}));
  }

  function refreshSidebar() {
    const manifest = window.MOOC_MANIFEST;
    if (!manifest) return;
    const progress = getProgress();
    const curSlug = currentModuleSlug();
    document.querySelectorAll('.mooc-module-item').forEach(li => {
      const modLink = li.querySelector('.mooc-mod-link');
      if (!modLink) return;
      const m = (modLink.getAttribute('href') || '').match(/(\d{2}-[a-z-]+)\/index\.html/);
      if (!m) return;
      const slug = m[1];
      const modProg = progress[slug] || {};
      // Stato modulo
      if (modProg.completed) modLink.setAttribute('data-mooc-completed', 'true');
      else modLink.removeAttribute('data-mooc-completed');
      // Sub-items
      const itemsDone = modProg.items || {};
      li.querySelectorAll('.mooc-item-link').forEach(a => {
        const hrefMatch = (a.getAttribute('href') || '').match(/#([a-z-]+)$/);
        if (!hrefMatch) return;
        const itemId = hrefMatch[1];
        if (itemsDone[itemId]) a.setAttribute('data-mooc-item-completed', 'true');
        else a.removeAttribute('data-mooc-item-completed');
      });
    });
  }

  function refreshModuleCompletion(moduleSlug) {
    // Auto-segna modulo come completato se tutti gli item presenti nella pagina sono done
    const itemsInPage = Array.from(document.querySelectorAll('.learn-card-header'))
      .map(h => h.id)
      .filter(id => KNOWN_ITEM_ANCHORS.includes(id));
    if (itemsInPage.length === 0) return;
    const done = getModuleItems(moduleSlug);
    const allDone = itemsInPage.every(id => done[id]);
    if (allDone) {
      const p = getProgress();
      p[moduleSlug] = p[moduleSlug] || { items: {} };
      if (!p[moduleSlug].completed) {
        p[moduleSlug].completed = true;
        p[moduleSlug].ts = Date.now();
        saveProgress(p);
        // Aggiorna anche il checkbox UI
        const cb = document.getElementById('cb-' + moduleSlug);
        if (cb) {
          cb.checked = true;
          const wrap = cb.closest('.module-completion');
          if (wrap) wrap.classList.add('done');
        }
      }
    }
  }

  // ============ QUIZ ============
  function initQuiz() {
    document.querySelectorAll('.quiz-container').forEach(container => {
      const checkBtn = container.querySelector('.quiz-check');
      const retryBtn = container.querySelector('.quiz-retry');
      const scoreEl = container.querySelector('.quiz-score');
      if (!checkBtn || checkBtn.__bound) return;
      checkBtn.__bound = true;

      checkBtn.addEventListener('click', () => {
        const questions = container.querySelectorAll('.quiz-question');
        let correct = 0;
        questions.forEach(q => {
          const correctIdx = parseInt(q.getAttribute('data-correct'));
          const selected = q.querySelector('input[type=radio]:checked');
          const feedback = q.querySelector('.quiz-feedback');
          const result = q.querySelector('.quiz-result');
          q.querySelectorAll('label').forEach(l => l.classList.remove('correct-pick', 'wrong-pick'));
          feedback.style.display = 'block';
          q.querySelectorAll('input[type=radio]').forEach(inp => inp.disabled = true);
          const correctLabel = q.querySelectorAll('.quiz-options label')[correctIdx];
          if (correctLabel) correctLabel.classList.add('correct-pick');
          if (selected && parseInt(selected.value) === correctIdx) {
            feedback.classList.remove('wrong'); feedback.classList.add('correct');
            result.textContent = '✓ Corretto';
            correct++;
          } else {
            feedback.classList.remove('correct'); feedback.classList.add('wrong');
            if (selected) {
              const wrongLabel = selected.closest('label');
              if (wrongLabel) wrongLabel.classList.add('wrong-pick');
              result.textContent = '✗ Non corretto — la risposta giusta è evidenziata';
            } else {
              result.textContent = '⚠ Nessuna risposta selezionata';
            }
          }
        });
        scoreEl.style.display = 'inline-block';
        scoreEl.textContent = `Punteggio: ${correct} / ${questions.length}`;
        scoreEl.classList.toggle('perfect', correct === questions.length);
        if (retryBtn) retryBtn.style.display = 'inline-block';
        checkBtn.style.display = 'none';

        // ATTIVITÀ COMPLETATA: aver verificato il quiz
        const moduleSlug = container.getAttribute('data-modulo');
        setItemCompleted(moduleSlug, 'verificare-quiz');
      });

      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          container.querySelectorAll('input[type=radio]').forEach(inp => { inp.disabled = false; inp.checked = false; });
          container.querySelectorAll('label').forEach(l => l.classList.remove('correct-pick', 'wrong-pick'));
          container.querySelectorAll('.quiz-feedback').forEach(f => f.style.display = 'none');
          scoreEl.style.display = 'none';
          retryBtn.style.display = 'none';
          checkBtn.style.display = 'inline-block';
        });
      }
    });
  }

  // ============ FLASHCARDS (event delegation) ============
  function initFlashcards() {
    if (window.__moocFlashcardsBound) return;
    window.__moocFlashcardsBound = true;
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.flashcard');
      if (!card || card.classList.contains('hidden')) return;
      card.classList.toggle('flipped');
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.flashcard');
      if (!card || card.classList.contains('hidden')) return;
      e.preventDefault();
      card.classList.toggle('flipped');
    });

    document.querySelectorAll('.flashcards-carousel').forEach(car => {
      if (car.__inited) return;
      car.__inited = true;
      const cards = car.querySelectorAll('.flashcard');
      const prevBtn = car.querySelector('.fc-prev');
      const nextBtn = car.querySelector('.fc-next');
      const counterCurrent = car.querySelector('.fc-current');
      const moduleSlug = car.getAttribute('data-modulo');
      const total = cards.length;
      const viewed = new Set();
      viewed.add(0);
      let idx = 0;

      function show(i) {
        cards.forEach((c, n) => {
          if (n === i) c.classList.remove('hidden'); else c.classList.add('hidden');
          if (n !== i) c.classList.remove('flipped');
        });
        if (counterCurrent) counterCurrent.textContent = (i + 1).toString();
        if (prevBtn) prevBtn.disabled = i === 0;
        if (nextBtn) nextBtn.disabled = i === total - 1;
        viewed.add(i);
        // ATTIVITÀ COMPLETATA: vista almeno l'80% delle carte
        if (viewed.size >= Math.max(1, Math.ceil(total * 0.8))) {
          setItemCompleted(moduleSlug, 'ripassare-flashcard');
        }
      }
      if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); if (idx > 0) { idx--; show(idx); } });
      if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); if (idx < total - 1) { idx++; show(idx); } });
      show(0);
    });
  }

  // ============ SLIDE CAROUSEL ============
  function initSlides() {
    document.querySelectorAll('.slide-carousel').forEach(car => {
      if (car.__inited) return;
      car.__inited = true;
      const imgs = car.querySelectorAll('.slide-img');
      const prev = car.querySelector('.slide-prev');
      const next = car.querySelector('.slide-next');
      const cur = car.querySelector('.slide-current');
      const moduleSlug = car.getAttribute('data-modulo');
      const total = imgs.length;
      const viewed = new Set();
      viewed.add(0);
      let idx = 0;
      function show(i) {
        imgs.forEach((im, n) => im.classList.toggle('hidden', n !== i));
        if (cur) cur.textContent = (i + 1).toString();
        if (prev) prev.disabled = i === 0;
        if (next) next.disabled = i === total - 1;
        viewed.add(i);
        if (viewed.size >= Math.max(1, Math.ceil(total * 0.8))) {
          setItemCompleted(moduleSlug, 'guardare-slide');
        }
      }
      if (prev) prev.addEventListener('click', () => { if (idx > 0) { idx--; show(idx); } });
      if (next) next.addEventListener('click', () => { if (idx < total - 1) { idx++; show(idx); } });
      imgs.forEach(im => im.addEventListener('click', () => {
        const lb = document.createElement('div');
        lb.className = 'slide-lightbox';
        const big = document.createElement('img');
        big.src = im.src;
        lb.appendChild(big);
        lb.addEventListener('click', () => lb.remove());
        document.body.appendChild(lb);
      }));
      car.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') prev && prev.click();
        if (e.key === 'ArrowRight') next && next.click();
      });
      car.setAttribute('tabindex', '0');
      show(0);
    });
  }

  // ============ AUDIO (podcast) ============
  function initAudio() {
    document.querySelectorAll('audio').forEach(audio => {
      if (audio.__inited) return;
      audio.__inited = true;
      const moduleSlug = currentModuleSlug();
      // Quando l'audio supera il 70% del totale, segna come completato
      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        if (audio.currentTime / audio.duration >= 0.7) {
          setItemCompleted(moduleSlug, 'ascoltare-podcast');
        }
      });
      audio.addEventListener('ended', () => {
        setItemCompleted(moduleSlug, 'ascoltare-podcast');
      });
    });
  }

  // ============ DISPENSA (scroll tracking) ============
  function initDispensaTracking() {
    const dispensa = document.querySelector('[data-reading-content]');
    if (!dispensa || dispensa.__inited) return;
    dispensa.__inited = true;
    const moduleSlug = currentModuleSlug();
    let triggered = false;
    function check() {
      if (triggered) return;
      const rect = dispensa.getBoundingClientRect();
      // Se l'utente ha scrollato a 80% del contenuto della dispensa
      const scrolledPast = rect.top + rect.height * 0.8 - window.innerHeight;
      if (scrolledPast <= 0) {
        triggered = true;
        setItemCompleted(moduleSlug, 'leggere-dispensa');
      }
    }
    window.addEventListener('scroll', check, { passive: true });
    check();  // first check
  }

  // ============ GLOSSARIO / RISORSE / OBIETTIVI (intersection observer) ============
  function initSectionViewTracking() {
    const moduleSlug = currentModuleSlug();
    if (!moduleSlug) return;
    const triggerMap = {
      'consultare-glossario': 'consultare-glossario',
      'scaricare-risorse': 'scaricare-risorse',
    };
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.id;
        if (triggerMap[id]) {
          setItemCompleted(moduleSlug, triggerMap[id]);
        }
      });
    }, { threshold: 0.4 });
    Object.keys(triggerMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });

    // Risorse: anche click sul link download conta
    document.querySelectorAll('a[href*="risorse/"]').forEach(a => {
      a.addEventListener('click', () => setItemCompleted(moduleSlug, 'scaricare-risorse'));
    });
  }

  // ============ MODULE COMPLETION (checkbox) ============
  function initCompletion() {
    document.querySelectorAll('.module-completion input[type=checkbox]').forEach(cb => {
      if (cb.__inited) return;
      cb.__inited = true;
      const slug = cb.getAttribute('data-modulo');
      const wrap = cb.closest('.module-completion');
      const p = getProgress();
      if (p[slug] && p[slug].completed) { cb.checked = true; wrap.classList.add('done'); }
      cb.addEventListener('change', () => {
        setModuleCompleted(slug, cb.checked);
        wrap.classList.toggle('done', cb.checked);
      });
    });
  }

  // ============ HOMEPAGE PROGRESS ============
  function initHomepageProgress() {
    const cards = document.querySelectorAll('.mooc-module-card');
    if (cards.length === 0) return;
    const p = getProgress();
    let done = 0;
    cards.forEach(card => {
      const slug = card.getAttribute('data-modulo');
      const fill = card.querySelector('.card-progress-fill');
      const modProg = p[slug] || {};
      if (modProg.completed) {
        card.classList.add('completed');
        done++;
        if (fill) fill.style.width = '100%';
      } else if (modProg.items) {
        // Calcola % attività completate
        const nDone = Object.keys(modProg.items).length;
        const pct = Math.min(100, Math.round(nDone / 7 * 100));  // 7 attività max
        if (fill) fill.style.width = pct + '%';
      }
    });
    const ofill = document.getElementById('overall-progress-fill');
    const ostats = document.getElementById('overall-progress-stats');
    const pct = cards.length ? (done / cards.length * 100) : 0;
    if (ofill) ofill.style.width = pct + '%';
    if (ostats) ostats.textContent = `${done} di ${cards.length} moduli completati`;
  }

  // ============ READING TIME ============
  function initReadingTime() {
    const content = document.querySelector('[data-reading-content]');
    const target = document.querySelector('[data-read]');
    if (!content || !target) return;
    const text = content.textContent || '';
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / 200));
    target.textContent = `~${minutes} min di lettura`;
  }

  // ============ PREV / NEXT MODULO ============
  function initModuleNav() {
    const navEl = document.querySelector('[data-modulo-nav]');
    if (!navEl) return;
    const links = Array.from(document.querySelectorAll('.md-nav--primary .md-nav__link'))
      .filter(a => {
        const href = a.getAttribute('href') || '';
        return href && href.match(/\d{2}-[a-z]/) && !href.startsWith('#');
      });
    let curIdx = -1;
    const here = location.pathname.replace(/\/$/, '');
    links.forEach((a, i) => {
      const linkHref = (a.getAttribute('href') || '').replace(/\/$/, '');
      if (linkHref && here.endsWith(linkHref)) curIdx = i;
    });
    const prev = navEl.querySelector('[data-prev]');
    const next = navEl.querySelector('[data-next]');
    if (curIdx > 0 && prev) {
      const a = links[curIdx - 1];
      prev.href = a.getAttribute('href');
      prev.style.display = 'inline-block';
    }
    if (curIdx >= 0 && curIdx < links.length - 1 && next) {
      const a = links[curIdx + 1];
      next.href = a.getAttribute('href');
      next.style.display = 'inline-block';
    }
  }

  // ============ INIT ============
  function init() {
    buildCustomSidebar();
    initQuiz();
    initFlashcards();
    initSlides();
    initAudio();
    initDispensaTracking();
    initSectionViewTracking();
    initCompletion();
    initHomepageProgress();
    initReadingTime();
    initModuleNav();
    refreshSidebar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  if (window.document$) window.document$.subscribe(init);
})();
