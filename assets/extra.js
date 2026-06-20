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
  const USER_KEY = 'mooc_user_v1';

  // ============ ACTIVITY BEACON (verso Apps Script) ============
  // Se MOOC_BEACON_URL è impostato (es. via assets/beacon-config.js),
  // ogni setItemCompleted manda un POST per registrare l'attività su Sheet.
  // Senza URL il MOOC continua a funzionare solo in locale (honor system).
  const BEACON_URL = (window.MOOC_BEACON_URL || '').trim();

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
    if (p[moduleSlug].items[itemId]) return;
    p[moduleSlug].items[itemId] = { done: true, ts: Date.now() };
    p[moduleSlug].ts = Date.now();
    saveProgress(p);
    refreshSidebar();
    refreshModuleCompletion(moduleSlug);
    // Beacon: spedisci l'evento al backend (best-effort)
    logActivityBeacon(moduleSlug, itemId);
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
        // Se l'item ha un href esplicito (es. quiz.html), usa quello.
        // Altrimenti fallback all'anchor della pagina del modulo.
        if (item.href) {
          subA.href = prefix + mod.slug + '/' + item.href;
        } else {
          subA.href = prefix + mod.slug + '/index.html#' + item.id;
        }
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

    // Quiz finale (con stato lucchetto/sbloccato)
    if (manifest.hasQuizFinale) {
      // Calcola se sbloccato (tutti i moduli completed)
      const allDone = manifest.modules.every(m => {
        const p = progress[m.slug] || {};
        return !!p.completed;
      });
      const qLabel = (allDone ? '🎓 ' : '🔒 ') + 'Quiz finale';
      const qItem = topItem(qLabel, prefix + 'quiz-finale.html', {'data-mooc-skip': 'true'});
      if (!allDone) qItem.style.opacity = '0.7';
      nav.appendChild(qItem);
    }
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
        const href = a.getAttribute('href') || '';
        // Match: anchor (#item-id) oppure sotto-pagina (es. quiz.html)
        let itemId = null;
        const ah = href.match(/#([a-z-]+)$/);
        if (ah) {
          itemId = ah[1];
        } else if (href.endsWith('quiz.html')) {
          itemId = 'verificare-quiz';
        }
        if (!itemId) return;
        if (itemsDone[itemId]) a.setAttribute('data-mooc-item-completed', 'true');
        else a.removeAttribute('data-mooc-item-completed');
      });
    });
  }

  function refreshModuleCompletion(moduleSlug) {
    // Auto-segna modulo come completato quando tutti gli item richiesti dal MANIFEST sono done.
    // Usa il manifest invece degli item presenti nella pagina, perché ora il quiz vive
    // in una sotto-pagina separata (quiz.html).
    let requiredIds = [];
    const manifest = window.MOOC_MANIFEST;
    if (manifest && manifest.modules) {
      const mod = manifest.modules.find(m => m.slug === moduleSlug);
      if (mod && mod.items) requiredIds = mod.items.map(it => it.id);
    }
    // Fallback: gli item presenti nella pagina (es. se il manifest non è caricato)
    if (requiredIds.length === 0) {
      requiredIds = Array.from(document.querySelectorAll('.learn-card-header'))
        .map(h => h.id)
        .filter(id => KNOWN_ITEM_ANCHORS.includes(id));
    }
    if (requiredIds.length === 0) return;
    const done = getModuleItems(moduleSlug);
    const allDone = requiredIds.every(id => done[id]);
    if (allDone) {
      const p = getProgress();
      p[moduleSlug] = p[moduleSlug] || { items: {} };
      if (!p[moduleSlug].completed) {
        p[moduleSlug].completed = true;
        p[moduleSlug].ts = Date.now();
        saveProgress(p);
        // Aggiorna anche il checkbox UI se presente
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

        // Vincolo rafforzato: quiz completato SOLO se passi con almeno il 60%
        const moduleSlug = container.getAttribute('data-modulo');
        if (questions.length > 0 && (correct / questions.length) >= 0.6) {
          setItemCompleted(moduleSlug, 'verificare-quiz');
        }
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
        // Vincolo rafforzato: TUTTE le carte viste
        if (viewed.size >= total) {
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
        // Vincolo rafforzato: TUTTE le slide viste
        if (viewed.size >= total) {
          setItemCompleted(moduleSlug, 'guardare-slide');
        }
      }
      if (prev) prev.addEventListener('click', () => { if (idx > 0) { idx--; show(idx); } });
      if (next) next.addEventListener('click', () => { if (idx < total - 1) { idx++; show(idx); } });
      imgs.forEach((im, n) => im.addEventListener('click', () => openLightbox(imgs, n)));
      car.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') prev && prev.click();
        if (e.key === 'ArrowRight') next && next.click();
      });
      car.setAttribute('tabindex', '0');
      show(0);
    });
  }

  // ============ LIGHTBOX NAVIGABILE ============
  function openLightbox(imgs, startIdx) {
    const total = imgs.length;
    let cur = startIdx;
    const lb = document.createElement('div');
    lb.className = 'slide-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Visualizzazione ingrandita slide');
    lb.tabIndex = -1;
    lb.innerHTML =
      '<button class="lightbox-close" aria-label="Chiudi (Esc)" title="Chiudi (Esc)">×</button>' +
      '<button class="lightbox-prev" aria-label="Slide precedente" title="Precedente (←)">‹</button>' +
      '<img class="lightbox-img" alt="">' +
      '<button class="lightbox-next" aria-label="Slide successiva" title="Successiva (→)">›</button>' +
      '<div class="lightbox-counter" aria-live="polite"><span class="lb-current">1</span> / <span class="lb-total">' + total + '</span></div>';
    const imgEl = lb.querySelector('.lightbox-img');
    const lbCur = lb.querySelector('.lb-current');
    const prevBtn = lb.querySelector('.lightbox-prev');
    const nextBtn = lb.querySelector('.lightbox-next');
    const closeBtn = lb.querySelector('.lightbox-close');

    function update() {
      imgEl.src = imgs[cur].src;
      imgEl.alt = imgs[cur].alt || ('Slide ' + (cur + 1) + ' di ' + total);
      lbCur.textContent = (cur + 1).toString();
      prevBtn.disabled = (cur === 0);
      nextBtn.disabled = (cur === total - 1);
    }
    function go(d) { cur = Math.max(0, Math.min(total - 1, cur + d)); update(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      lb.remove();
      document.body.classList.remove('lightbox-open');
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    }

    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); go(-1); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); go(1); });
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    // Click sul backdrop chiude, ma non sull'immagine o sui bottoni
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(lb);
    document.body.classList.add('lightbox-open');
    lb.focus();
    update();
  }

  // ============ AUDIO (podcast) ============
  function initAudio() {
    document.querySelectorAll('audio').forEach(audio => {
      if (audio.__inited) return;
      audio.__inited = true;
      const moduleSlug = currentModuleSlug();
      // Vincolo rafforzato: audio deve raggiungere il 90% (~o ended)
      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        if (audio.currentTime / audio.duration >= 0.9) {
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
      // Vincolo rafforzato: scroll al 95% del contenuto della dispensa
      const scrolledPast = rect.top + rect.height * 0.95 - window.innerHeight;
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

  // ============ QUIZ FINALE GATE ============
  function initQuizGate() {
    const gate = document.getElementById('quiz-gate');
    if (!gate) return;
    const manifest = window.MOOC_MANIFEST;
    if (!manifest || !manifest.modules) return;

    const progress = getProgress();
    const modules = manifest.modules;
    let completati = 0;
    const missing = [];

    modules.forEach((mod, idx) => {
      const modProg = progress[mod.slug] || {};
      const isCompleted = !!modProg.completed;
      if (isCompleted) {
        completati++;
      } else {
        // Cerco quale modulo manca e cosa serve
        const items = modProg.items || {};
        const itemsTot = (mod.items || []).length;
        const itemsDone = Object.keys(items).length;
        const titolo = mod.title.replace(/^Modulo\s+\d+\s*[-—–:]\s*/, '');
        missing.push({
          idx: idx + 1,
          title: titolo,
          itemsDone,
          itemsTot,
        });
      }
    });

    const totale = modules.length;
    const pct = totale > 0 ? Math.round(completati / totale * 100) : 0;
    const isUnlocked = completati >= totale;

    // Aggiorna progress bar
    const fill = document.getElementById('gate-progress-fill');
    if (fill) fill.style.width = pct + '%';

    const stats = document.getElementById('gate-progress-stats');
    if (stats) stats.textContent = completati + ' di ' + totale + ' moduli completati (' + pct + '%)';

    // Aggiorna lista missing
    const missingEl = document.getElementById('gate-missing');
    if (missingEl) {
      if (missing.length === 0) {
        missingEl.innerHTML = '<li class="done">Tutte le attività sono completate!</li>';
      } else {
        missingEl.innerHTML = missing.map(m =>
          '<li><strong>Modulo ' + m.idx + '</strong> — ' + m.title +
          ' <span style="color:#888;font-size:0.85em">(' + m.itemsDone + '/' + m.itemsTot + ' attività)</span></li>'
        ).join('');
      }
    }

    // Sblocco
    if (isUnlocked) {
      gate.classList.add('unlocked');
      document.body.setAttribute('data-quiz-unlocked', 'true');
    } else {
      gate.classList.remove('unlocked');
      document.body.removeAttribute('data-quiz-unlocked');
    }

    // Mostra i dati del corsista nella sezione sbloccata
    const user = getStoredUser();
    const unlockedDiv = gate.querySelector('.gate-unlocked');
    if (unlockedDiv) {
      let userInfo = unlockedDiv.querySelector('.gate-user-info');
      if (!userInfo) {
        userInfo = document.createElement('div');
        userInfo.className = 'gate-user-info';
        unlockedDiv.insertBefore(userInfo, unlockedDiv.firstChild.nextSibling);
      }
      if (user) {
        userInfo.innerHTML =
          '<div class="gate-user-card">' +
            '<strong>Compili come:</strong> ' + esc_(user.name) + ' &lt;' + esc_(user.email) + '&gt;' +
            (user.school ? ' <span class="gate-user-school">— ' + esc_(user.school) + '</span>' : '') +
            ' <button type="button" class="gate-user-edit" aria-label="Modifica">✎ modifica</button>' +
          '</div>' +
          '<p class="gate-user-note">⚠ Quando compili il form del quiz, usa <strong>esattamente</strong> questi dati ' +
          '(li trovi anche in alto a destra). Servono per associare il quiz al tuo attestato.</p>';
        const editBtn = userInfo.querySelector('.gate-user-edit');
        if (editBtn) editBtn.addEventListener('click', () => openUserPrompt({ edit: true }));
      } else {
        userInfo.innerHTML =
          '<div class="gate-user-card gate-user-missing">' +
            '⚠ Non hai ancora inserito i tuoi dati. ' +
            '<button type="button" class="gate-user-edit">Inserisci nome e email →</button>' +
          '</div>';
        const editBtn = userInfo.querySelector('.gate-user-edit');
        if (editBtn) editBtn.addEventListener('click', () => openUserPrompt());
      }
    }
  }


  // ============ SESSIONE LOCALE CORSISTA ============
  // Al primo accesso, mostra un modale che chiede nome+cognome+email.
  // I dati sono salvati in localStorage (browser locale) — niente OAuth, niente backend.
  // Servono per: identificare il corsista in alto a destra, e per pre-compilare
  // il Quiz finale con i dati corretti (URL params).

  function getStoredUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setStoredUser(u) {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }

  function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function openUserPrompt(opts) {
    // Guard: se c'è già un modale aperto, non aprirne un altro
    if (document.body.classList.contains('mooc-modal-open')) return;
    // Pulizia di eventuali residui (es. navigazione MkDocs Material)
    document.querySelectorAll('.mooc-user-modal-overlay').forEach(el => el.remove());

    const existing = getStoredUser() || {};
    const isEdit = !!opts && opts.edit;
    // Modale — uso class+querySelector locale invece di ID globali per evitare collisioni
    const overlay = document.createElement('div');
    overlay.className = 'mooc-user-modal-overlay';
    overlay.innerHTML =
      '<div class="mooc-user-modal" role="dialog" aria-modal="true" aria-labelledby="mum-title">' +
        '<h2 id="mum-title">👋 ' + (isEdit ? 'Modifica i tuoi dati' : 'Benvenutə nel MOOC') + '</h2>' +
        '<p>Prima di iniziare, inserisci il tuo <strong>nome e cognome</strong> e la tua <strong>email</strong>. ' +
        'I dati restano <strong>solo nel tuo browser</strong> e vengono usati alla fine per compilare il quiz di certificazione con i tuoi dati corretti.</p>' +
        '<form class="mum-form" novalidate>' +
          '<label>Nome e cognome <input type="text" class="mum-name" required minlength="3" autocomplete="name" value="' + esc_(existing.name || '') + '"></label>' +
          '<label>Email <input type="email" class="mum-email" required autocomplete="email" value="' + esc_(existing.email || '') + '"></label>' +
          '<label>Scuola (opzionale) <input type="text" class="mum-school" autocomplete="organization" value="' + esc_(existing.school || '') + '"></label>' +
          '<div class="mum-err"></div>' +
          '<div class="mum-actions">' +
            (isEdit ? '<button type="button" class="mum-cancel">Annulla</button>' : '') +
            '<button type="submit" class="mum-submit">' + (isEdit ? 'Salva' : 'Inizia il corso →') + '</button>' +
          '</div>' +
        '</form>' +
        '<p class="mum-privacy">Privacy: i dati sono salvati esclusivamente nel localStorage del browser. ' +
        'Se cambi browser, dispositivo o pulisci la cache, dovrai inserirli di nuovo.</p>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('mooc-modal-open');

    // Focus sul primo input — query locale all'overlay
    setTimeout(() => {
      const nameEl = overlay.querySelector('.mum-name');
      if (nameEl) nameEl.focus();
    }, 50);

    function close() {
      overlay.remove();
      document.body.classList.remove('mooc-modal-open');
    }

    const form = overlay.querySelector('.mum-form');
    // Submit handler — uso capture e stopPropagation per evitare interferenze
    // con eventuali listener globali (es. instant-loading di MkDocs Material).
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = (overlay.querySelector('.mum-name').value || '').trim();
      const email = (overlay.querySelector('.mum-email').value || '').trim();
      const school = (overlay.querySelector('.mum-school').value || '').trim();
      const err = overlay.querySelector('.mum-err');
      if (name.length < 3) { err.textContent = 'Inserisci nome e cognome (almeno 3 caratteri).'; return false; }
      if (!isValidEmail(email)) { err.textContent = 'Email non valida.'; return false; }

      // Salva con verifica: ricontrolla dopo write
      try {
        setStoredUser({ name, email, school, since: Date.now() });
        const check = getStoredUser();
        if (!check || check.email !== email) {
          err.textContent = 'Errore di salvataggio. Riprova (controlla se localStorage è abilitato).';
          return false;
        }
      } catch (ex) {
        err.textContent = 'Errore di salvataggio: ' + (ex.message || ex);
        return false;
      }

      close();
      renderUserBadge();
      const gate = document.getElementById('quiz-gate');
      if (gate) initQuizGate();
      return false;
    });

    // Bottoni: usano querySelector locale all'overlay
    const cancelBtn = overlay.querySelector('.mum-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      close();
    });

    // Anche Esc chiude (solo in edit mode, perché al primo accesso è obbligatorio)
    if (isEdit) {
      const onEsc = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onEsc);
          close();
        }
      };
      document.addEventListener('keydown', onEsc);
    }
  }

  function ensureToolbar() {
    let bar = document.getElementById('mooc-toolbar');
    if (bar && document.body.contains(bar)) return bar;
    bar = document.createElement('div');
    bar.id = 'mooc-toolbar';
    bar.className = 'mooc-toolbar';
    document.body.appendChild(bar);
    return bar;
  }

  function renderUserBadge() {
    const toolbar = ensureToolbar();
    let box = document.getElementById('mooc-auth-box');
    if (!box || !toolbar.contains(box)) {
      if (box) box.remove();
      box = document.createElement('div');
      box.id = 'mooc-auth-box';
      box.className = 'mooc-auth-box';
      toolbar.appendChild(box);   // sempre dopo il fs-toggle se presente
    }
    const user = getStoredUser();
    if (user) {
      const initial = (user.name || '?').trim().charAt(0).toUpperCase();
      box.innerHTML =
        '<div class="auth-user" title="' + esc_(user.email) + '">' +
          '<span class="auth-avatar-fallback">' + esc_(initial) + '</span>' +
          '<span class="auth-name">' + esc_(user.name) + '</span>' +
          '<button class="auth-edit" title="Modifica i tuoi dati" aria-label="Modifica i tuoi dati">✎</button>' +
          '<button class="auth-reset" title="Resetta il completamento delle attività" aria-label="Resetta progresso">🔄</button>' +
        '</div>';
      const editBtn = box.querySelector('.auth-edit');
      if (editBtn) editBtn.addEventListener('click', () => openUserPrompt({ edit: true }));
      const resetBtn = box.querySelector('.auth-reset');
      if (resetBtn) resetBtn.addEventListener('click', resetProgressWithConfirm);
    } else {
      box.innerHTML = '<button class="auth-signin" title="Identificati per il MOOC">👤 Identificati</button>';
      box.querySelector('.auth-signin').addEventListener('click', () => openUserPrompt());
    }
  }

  // Reset progresso (mantiene l'identità del corsista, azzera solo le attività completate)
  function resetProgressWithConfirm() {
    const p = getProgress();
    const nModules = Object.keys(p).length;
    let nActivities = 0;
    Object.values(p).forEach(m => {
      if (m && m.items) nActivities += Object.keys(m.items).length;
    });
    const summary = nModules === 0
      ? "Non hai ancora completato nessuna attività."
      : "Hai " + nActivities + " attività completate su " + nModules + " moduli.";

    const msg =
      "⚠ Reset del progresso\n\n" +
      summary + "\n\n" +
      "Sei sicurə di voler azzerare TUTTO il completamento delle attività?\n" +
      "Dovrai ripercorrere il MOOC da capo (i tuoi dati nome/email restano).\n\n" +
      "Premi OK per confermare, oppure Annulla.";

    if (!window.confirm(msg)) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
      // Pulisci anche eventuali tracce di beacon già inviati (lo stato in-memory)
      try { Object.keys(_beaconSent).forEach(k => { delete _beaconSent[k]; }); } catch (e) {}
    } catch (e) {
      window.alert("Errore durante il reset: " + (e && e.message ? e.message : e));
      return;
    }
    // Aggiorna UI
    refreshSidebar();
    const gate = document.getElementById('quiz-gate');
    if (gate) initQuizGate();
    // Aggiorna anche i checkbox di completamento manuale
    document.querySelectorAll('.module-completion input[type=checkbox]').forEach(cb => {
      cb.checked = false;
      const wrap = cb.closest('.module-completion');
      if (wrap) wrap.classList.remove('done');
    });
    // Reload per ridisegnare tutto pulito (homepage progress, item-level UI, etc.)
    setTimeout(() => { window.location.reload(); }, 100);
  }

  function initLocalSession() {
    renderUserBadge();
    const user = getStoredUser();
    if (!user) {
      // openUserPrompt() ha guard interno: niente stacking di modali.
      openUserPrompt();
    }
  }

  function esc_(s) { return String(s||'').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // ============ BEACON: registra l'attività sul backend ============
  // Best-effort: se manca BEACON_URL o l'utente non si è identificato, skip.
  // Dedup-locale: se la stessa (modulo, item) è già stata inviata, salta.
  const _beaconSent = {};
  function logActivityBeacon(moduleSlug, itemId) {
    if (!BEACON_URL) return;
    const user = getStoredUser();
    if (!user || !user.email) return;
    const key = (user.email + '|' + moduleSlug + '|' + itemId).toLowerCase();
    if (_beaconSent[key]) return;
    _beaconSent[key] = true;
    const payload = {
      action: 'log_activity',
      email: user.email,
      name: user.name || '',
      school: user.school || '',
      modulo: moduleSlug,
      activity_id: itemId,
      ts: Date.now(),
      user_agent: (navigator.userAgent || '').substring(0, 200),
    };
    try {
      fetch(BEACON_URL, {
        method: 'POST',
        // text/plain evita il preflight CORS — Apps Script non risponde a OPTIONS
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload),
        // no-cors: il MOOC non legge la risposta (best-effort)
        mode: 'no-cors',
        keepalive: true,
      }).catch(() => { /* silenzioso */ });
    } catch (e) { /* silenzioso */ }
  }

  // ============ FONT-SIZE TOGGLE (A− / A+) ============
  const FONT_STEPS = [0.875, 1.0, 1.125, 1.25, 1.4];
  const FONT_KEY = 'mooc_font_step';

  function getFontStep() {
    const raw = parseInt(localStorage.getItem(FONT_KEY) || '1', 10);
    return Math.max(0, Math.min(FONT_STEPS.length - 1, isNaN(raw) ? 1 : raw));
  }
  function applyFontStep(step) {
    document.documentElement.style.setProperty('--mooc-font-scale', FONT_STEPS[step]);
    document.documentElement.setAttribute('data-mooc-font-step', step.toString());
    localStorage.setItem(FONT_KEY, step.toString());
    const lbl = document.getElementById('mooc-fs-label');
    if (lbl) lbl.textContent = Math.round(FONT_STEPS[step] * 100) + '%';
  }

  function initFontSizeToggle() {
    const toolbar = ensureToolbar();
    let host = document.getElementById('mooc-fs-toggle');
    if (host && toolbar.contains(host)) {
      applyFontStep(getFontStep());
      return;
    }
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'mooc-fs-toggle';
    host.className = 'mooc-fs-toggle';
    host.innerHTML =
      '<button class="fs-btn fs-minus" aria-label="Riduci dimensione testo" title="Riduci testo">A−</button>' +
      '<span class="fs-label" id="mooc-fs-label">100%</span>' +
      '<button class="fs-btn fs-plus" aria-label="Aumenta dimensione testo" title="Aumenta testo">A+</button>';
    // Inserisci il fs-toggle PRIMA del badge auth (a sinistra)
    const authBox = toolbar.querySelector('.mooc-auth-box');
    if (authBox) toolbar.insertBefore(host, authBox);
    else toolbar.appendChild(host);

    host.querySelector('.fs-minus').addEventListener('click', () => {
      const s = getFontStep();
      if (s > 0) applyFontStep(s - 1);
    });
    host.querySelector('.fs-plus').addEventListener('click', () => {
      const s = getFontStep();
      if (s < FONT_STEPS.length - 1) applyFontStep(s + 1);
    });
    applyFontStep(getFontStep());
  }

  // ============ EXCLUSIVE PLAYBACK: solo un video/audio alla volta ============
  // Quando un iframe YouTube va in 'playing', pausa tutti gli altri iframe + l'audio podcast.
  // Idem viceversa: se parte l'audio podcast, pausa i video YouTube.
  function postToFrame(iframe, func, args) {
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: func, args: args || [] }),
        '*'
      );
    } catch (e) { /* silenzioso */ }
  }
  function pauseAllOthers(activeIframe) {
    document.querySelectorAll('.videotutorial-grid iframe').forEach(f => {
      if (f !== activeIframe) postToFrame(f, 'pauseVideo');
    });
    // Pausa anche l'audio podcast se sta suonando
    document.querySelectorAll('audio').forEach(a => {
      if (!a.paused) try { a.pause(); } catch (e) {}
    });
  }
  function pauseAllVideos() {
    document.querySelectorAll('.videotutorial-grid iframe').forEach(f => {
      postToFrame(f, 'pauseVideo');
    });
  }

  function initExclusivePlayback() {
    if (window.__exclusivePlaybackInit) return;
    window.__exclusivePlaybackInit = true;

    // Listener postMessage da YouTube
    window.addEventListener('message', (e) => {
      // Solo messaggi da youtube
      const origin = String(e.origin || '');
      if (origin.indexOf('youtube') === -1) return;
      let data;
      try { data = (typeof e.data === 'string') ? JSON.parse(e.data) : e.data; }
      catch (ex) { return; }
      if (!data) return;
      // YT manda info come { event: 'onStateChange', info: 1 } dove info=1 è "playing"
      if (data.event === 'onStateChange' && data.info === 1) {
        // Identifica quale iframe ha originato il play (e.source === iframe.contentWindow)
        let activeIframe = null;
        document.querySelectorAll('.videotutorial-grid iframe').forEach(f => {
          if (f.contentWindow === e.source) activeIframe = f;
        });
        if (activeIframe) pauseAllOthers(activeIframe);
      }
    }, false);

    // Quando si attivano iframe nuovi, registrali per ricevere eventi
    function registerIframes() {
      document.querySelectorAll('.videotutorial-grid iframe').forEach(f => {
        if (f.__listenerRegistered) return;
        f.__listenerRegistered = true;
        // Aspetta che l'iframe sia caricato
        const sendListen = () => {
          try {
            f.contentWindow.postMessage(
              JSON.stringify({ event: 'listening', id: f.src }),
              '*'
            );
            // YouTube IFrame API: invia 'addEventListener' per onStateChange
            f.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
              '*'
            );
          } catch (e) { /* silenzioso */ }
        };
        if (f.contentWindow) sendListen();
        f.addEventListener('load', sendListen);
      });
    }
    registerIframes();

    // Quando parte l'audio del podcast, pausa tutti i video
    document.querySelectorAll('audio').forEach(a => {
      a.addEventListener('play', () => pauseAllVideos());
    });
  }

  // ============ VIDEOTUTORIAL: tracking visualizzazione ============
  function initVideotutorial() {
    const grid = document.querySelector('.videotutorial-grid');
    if (!grid) return;
    const moduleSlug = grid.getAttribute('data-modulo');
    // Quando l'utente clicca/interagisce con un iframe video, segna come completato
    // Per iframe YouTube non possiamo intercettare il play, ma il click sulla card è un buon proxy.
    let interacted = 0;
    const total = grid.querySelectorAll('.vt-card').length;
    grid.querySelectorAll('.vt-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.__interacted) return;
        card.__interacted = true;
        interacted++;
        // segna completato dopo che ne ha aperto almeno il 50%
        if (interacted >= Math.max(1, Math.ceil(total * 0.5))) {
          setItemCompleted(moduleSlug, 'video-tutorial');
        }
      }, { capture: true });
    });
    // Fallback: dopo 60 secondi di pagina, considera la sezione "vista" se è nel viewport
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setTimeout(() => {
              const r = grid.getBoundingClientRect();
              if (r.top < window.innerHeight && r.bottom > 0) {
                setItemCompleted(moduleSlug, 'video-tutorial');
              }
            }, 30000);  // 30s nel viewport
          }
        });
      }, { threshold: 0.3 });
      obs.observe(grid);
    }
  }

  // ============ PROMPT LAB (prova un prompt su Gemini / ChatGPT / Claude) ============
  function initPromptLab() {
    if (document.getElementById('mooc-prompt-lab-btn')) return;
    // Solo su pagine modulo, non su home
    if (!document.querySelector('.learn-card')) return;

    const fab = document.createElement('button');
    fab.id = 'mooc-prompt-lab-btn';
    fab.className = 'mooc-pl-fab';
    fab.title = 'Prova un prompt su Gemini / ChatGPT / Claude';
    fab.setAttribute('aria-label', 'Apri il Prompt Lab');
    fab.innerHTML = '🧪 <span class="mooc-pl-fab-label">Prova il prompt</span>';
    document.body.appendChild(fab);

    const drawer = document.createElement('div');
    drawer.id = 'mooc-prompt-lab';
    drawer.className = 'mooc-pl-drawer';
    drawer.innerHTML =
      '<div class="mooc-pl-header">' +
        '<h3>🧪 Prompt Lab</h3>' +
        '<button class="mooc-pl-close" aria-label="Chiudi (Esc)">×</button>' +
      '</div>' +
      '<p class="mooc-pl-hint">Incolla qui (o seleziona prima il testo nella dispensa e premi <kbd>Cmd</kbd>+<kbd>K</kbd>) un prompt da provare. Poi clicca uno dei pulsanti: il prompt si apre in una nuova finestra già precompilato.</p>' +
      '<textarea class="mooc-pl-ta" placeholder="Incolla qui il prompt…" rows="8"></textarea>' +
      '<div class="mooc-pl-actions">' +
        '<button class="mooc-pl-go mooc-pl-go-gemini" data-target="gemini">Apri in Gemini →</button>' +
        '<button class="mooc-pl-go mooc-pl-go-gpt"    data-target="chatgpt">Apri in ChatGPT →</button>' +
        '<button class="mooc-pl-go mooc-pl-go-claude" data-target="claude">Apri in Claude →</button>' +
      '</div>' +
      '<div class="mooc-pl-actions-sec">' +
        '<button class="mooc-pl-copy">📋 Copia negli appunti</button>' +
        '<button class="mooc-pl-clear">🗑 Svuota</button>' +
      '</div>' +
      '<p class="mooc-pl-footer">Apre in <strong>nuova finestra</strong>. Devi essere già loggato sul servizio scelto.</p>';
    document.body.appendChild(drawer);

    const ta = drawer.querySelector('.mooc-pl-ta');

    function openDrawer() {
      drawer.classList.add('open');
      fab.classList.add('hidden');
      // Se l'utente aveva selezionato del testo, precompila la textarea
      const sel = (window.getSelection && window.getSelection().toString() || '').trim();
      if (sel && sel.length > 5 && !ta.value) ta.value = sel;
      setTimeout(() => ta.focus(), 100);
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      fab.classList.remove('hidden');
    }

    fab.addEventListener('click', openDrawer);
    drawer.querySelector('.mooc-pl-close').addEventListener('click', closeDrawer);

    // Esc per chiudere
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        e.preventDefault();
        closeDrawer();
      }
      // Cmd/Ctrl + K = apri lab con selezione corrente
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !drawer.classList.contains('open')) {
        e.preventDefault();
        openDrawer();
      }
    });

    // URL builders per ogni provider
    const PROVIDERS = {
      gemini:  { url: 'https://gemini.google.com/app',       param: 'text' },
      chatgpt: { url: 'https://chatgpt.com/',                 param: 'q'    },
      claude:  { url: 'https://claude.ai/new',                param: 'q'    },
    };

    drawer.querySelectorAll('.mooc-pl-go').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = (ta.value || '').trim();
        if (!prompt) {
          ta.focus();
          ta.style.borderColor = '#c81f1f';
          setTimeout(() => { ta.style.borderColor = ''; }, 1500);
          return;
        }
        const target = btn.getAttribute('data-target');
        const cfg = PROVIDERS[target];
        if (!cfg) return;
        // I parametri URL hanno limiti pratici (~2000 char in alcuni browser).
        // Se il prompt è troppo lungo, oltre ad aprire la pagina, lo copio negli appunti
        // come safety net.
        const url = cfg.url + '?' + cfg.param + '=' + encodeURIComponent(prompt);
        window.open(url, '_blank', 'noopener,noreferrer');
        // Fallback: copia anche negli appunti se il prompt è lungo
        if (prompt.length > 1500 && navigator.clipboard) {
          navigator.clipboard.writeText(prompt).catch(() => {});
        }
      });
    });

    // Copia
    drawer.querySelector('.mooc-pl-copy').addEventListener('click', () => {
      const prompt = (ta.value || '').trim();
      if (!prompt) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(prompt).then(() => {
          const btn = drawer.querySelector('.mooc-pl-copy');
          const old = btn.textContent;
          btn.textContent = '✓ Copiato';
          setTimeout(() => { btn.textContent = old; }, 1500);
        });
      }
    });

    // Svuota
    drawer.querySelector('.mooc-pl-clear').addEventListener('click', () => {
      ta.value = '';
      ta.focus();
    });
  }

  // ============ INIT ============
  function init() {
    initLocalSession();
    initFontSizeToggle();
    initVideotutorial();
    initExclusivePlayback();
    initPromptLab();
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
    initQuizGate();
    refreshSidebar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  if (window.document$) window.document$.subscribe(init);
})();
