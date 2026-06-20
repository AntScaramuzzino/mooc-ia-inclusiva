/* ============================================================
   SCORM LAUNCHER — logica di tracciamento del MOOC
   Mantiene UNA sola sessione SCORM (questo file = unico SCO) e
   carica il corso in un iframe same-origin. Legge i progressi dal
   localStorage condiviso (chiave 'mooc_progress_v2') e i punteggi
   dei quiz di modulo (catturati in 'mooc_scorm_quiz'), poi riporta
   completamento e punteggio all'LMS.

   Funziona identico in SCORM 1.2 e 2004 (la versione la rileva il
   wrapper). Nessuna modifica alle pagine HTML del corso.
   ============================================================ */
(function () {
  "use strict";

  var PASS_THRESHOLD = 70;        // % minima dei quiz di modulo per "passed"
  var POLL_MS = 4000;             // frequenza di sincronizzazione con l'LMS
  var PROGRESS_KEY = "mooc_progress_v2";
  var QUIZ_KEY = "mooc_scorm_quiz";

  var SCORM = window.pipwerk && window.pipwerk.SCORM;
  var MODULES = (window.MOOC_MANIFEST && window.MOOC_MANIFEST.modules || []).map(function (m) { return m.slug; });
  var startTime = Date.now();
  var connected = false;
  var finished = false;

  function $(id) { return document.getElementById(id); }

  function setBadge(text, cls) {
    var el = $("scorm-status");
    if (el) { el.textContent = text; el.className = "scorm-badge " + (cls || ""); }
  }

  // ---- lettura stato dal localStorage condiviso ---------------------
  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  }

  function computeCompletion() {
    if (!MODULES.length) return { done: 0, total: 0, frac: 0, all: false };
    var p = readJSON(PROGRESS_KEY), done = 0;
    MODULES.forEach(function (s) { if (p[s] && p[s].completed) done++; });
    return { done: done, total: MODULES.length, frac: done / MODULES.length, all: done === MODULES.length };
  }

  function computeScore() {
    var s = readJSON(QUIZ_KEY), correct = 0, total = 0;
    Object.keys(s).forEach(function (k) {
      if (s[k] && typeof s[k].correct === "number") { correct += s[k].correct; total += s[k].total; }
    });
    if (!total) return null;
    return Math.round((correct / total) * 100);
  }

  // ---- iniezione cattura punteggi quiz nell'iframe ------------------
  function injectQuizCapture(win) {
    try {
      var doc = win.document;
      var containers = doc.querySelectorAll(".quiz-container");
      if (!containers.length) return;
      containers.forEach(function (container) {
        var btn = container.querySelector(".quiz-check");
        if (!btn || btn.__scormHooked) return;
        btn.__scormHooked = true;
        btn.addEventListener("click", function () {
          setTimeout(function () {
            var scoreEl = container.querySelector(".quiz-score");
            var qCount = container.querySelectorAll(".quiz-question").length;
            if (!scoreEl || !qCount) return;
            var m = (scoreEl.textContent || "").match(/(\d+)\s*\/\s*(\d+)/);
            var correct = m ? parseInt(m[1], 10) : 0;
            var total = m ? parseInt(m[2], 10) : qCount;
            var slug = moduleSlugFromPath(win.location.pathname);
            var store = readJSON(QUIZ_KEY);
            // teniamo il punteggio migliore per ciascun modulo
            if (!store[slug] || correct > store[slug].correct) {
              store[slug] = { correct: correct, total: total };
              try { localStorage.setItem(QUIZ_KEY, JSON.stringify(store)); } catch (e) {}
            }
            sync();
          }, 60);
        });
      });
    } catch (e) { /* cross-origin o pagina non pronta: ignora */ }
  }

  function moduleSlugFromPath(path) {
    for (var i = 0; i < MODULES.length; i++) {
      if (path.indexOf(MODULES[i]) >= 0) return MODULES[i];
    }
    return "altro";
  }

  // ---- sincronizzazione con l'LMS -----------------------------------
  function sessionTime1_2() {
    var s = Math.floor((Date.now() - startTime) / 1000);
    var hh = String(Math.floor(s / 3600)).padStart(2, "0");
    var mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    var ss = String(s % 60).padStart(2, "0");
    return hh + ":" + mm + ":" + ss;
  }
  function sessionTime2004() {
    var s = Math.floor((Date.now() - startTime) / 1000);
    return "PT" + s + "S";
  }

  function sync() {
    var c = computeCompletion();
    var score = computeScore();
    updateUI(c, score);

    if (!connected) return;
    var is2004 = SCORM.version === "2004";

    if (score !== null) {
      if (is2004) {
        SCORM.set("cmi.score.raw", score);
        SCORM.set("cmi.score.min", 0);
        SCORM.set("cmi.score.max", 100);
        SCORM.set("cmi.score.scaled", (score / 100).toFixed(4));
      } else {
        SCORM.set("cmi.core.score.raw", score);
        SCORM.set("cmi.core.score.min", 0);
        SCORM.set("cmi.core.score.max", 100);
      }
    }

    if (is2004) {
      SCORM.set("cmi.progress_measure", c.frac.toFixed(4));
      SCORM.set("cmi.completion_status", c.all ? "completed" : "incomplete");
      if (c.all) SCORM.set("cmi.success_status", (score === null || score >= PASS_THRESHOLD) ? "passed" : "failed");
    } else {
      if (c.all) {
        SCORM.set("cmi.core.lesson_status",
          score !== null ? (score >= PASS_THRESHOLD ? "passed" : "failed") : "completed");
      } else {
        SCORM.set("cmi.core.lesson_status", "incomplete");
      }
    }
    SCORM.save();
  }

  function updateUI(c, score) {
    var prog = $("scorm-progress");
    if (prog) prog.textContent = c.done + " / " + c.total + " moduli completati"
      + (score !== null ? "  ·  Quiz: " + score + "%" : "");
    if (c.all) setBadge(connected ? "Completato — salvato sull'LMS" : "Completato (modalità anteprima)", "ok");
    else setBadge(connected ? "In corso — collegato all'LMS" : "Anteprima (nessun LMS rilevato)", connected ? "live" : "warn");
  }

  function finish() {
    if (finished) return;
    finished = true;
    sync();
    if (connected) {
      if (SCORM.version === "2004") SCORM.set("cmi.session_time", sessionTime2004());
      else SCORM.set("cmi.core.session_time", sessionTime1_2());
      SCORM.quit();
    }
  }

  // ---- avvio --------------------------------------------------------
  function start() {
    var frame = $("course-frame");

    if (SCORM) {
      connected = SCORM.init();
      if (connected) {
        // stato iniziale
        var entry = SCORM.version === "2004" ? "cmi.entry" : "cmi.core.entry";
        // non forziamo nulla se l'utente sta riprendendo
        sync();
      }
    }
    if (!connected) setBadge("Anteprima (nessun LMS rilevato)", "warn");

    if (frame) {
      frame.addEventListener("load", function () {
        try { injectQuizCapture(frame.contentWindow); } catch (e) {}
        // re-inietta a ogni navigazione interna
      });
    }

    setInterval(sync, POLL_MS);
    window.addEventListener("pagehide", finish);
    window.addEventListener("beforeunload", finish);
    window.addEventListener("unload", finish);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
