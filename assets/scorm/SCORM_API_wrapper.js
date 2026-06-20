/* ============================================================
   SCORM API Wrapper — supporta SCORM 1.2 e SCORM 2004
   Basato sul pattern "pipwerk" (Philip Hutchison, MIT License),
   semplificato e adattato per il MOOC "L'IA come co-pilota".

   Espone: window.pipwerk.SCORM con i metodi
     .version        -> "1.2" | "2004" | null (auto-rilevata)
     .init()         -> bool   (LMSInitialize / Initialize)
     .get(param)     -> string (LMSGetValue / GetValue)
     .set(param,val) -> bool   (LMSSetValue / SetValue)
     .save()         -> bool   (LMSCommit / Commit)
     .quit()         -> bool   (LMSFinish / Terminate)
     .status(s?)     -> get/set lo stato sintetico
   ============================================================ */
(function (w) {
  "use strict";

  var pipwerk = w.pipwerk || (w.pipwerk = {});
  var SCORM = pipwerk.SCORM = pipwerk.SCORM || {};

  SCORM.version = null;          // "1.2" | "2004"
  SCORM.handle = null;           // riferimento all'oggetto API esposto dall'LMS
  SCORM.isActive = false;
  SCORM.debug = false;

  function log() {
    if (SCORM.debug && w.console) {
      try { console.log.apply(console, ["[SCORM]"].concat([].slice.call(arguments))); } catch (e) {}
    }
  }

  // --- Trova l'API risalendo la catena dei frame/finestre -------------
  function findAPIInWindow(win) {
    var tries = 0;
    while (win) {
      if (win.API_1484_11) { SCORM.version = "2004"; return win.API_1484_11; }
      if (win.API)         { SCORM.version = "1.2";  return win.API; }
      if (!win.parent || win.parent === win) break;
      win = win.parent;
      if (++tries > 200) break;
    }
    return null;
  }

  function getAPI() {
    var api = findAPIInWindow(w);
    // prova anche la finestra che ha aperto questa (popup launch)
    if (!api && w.opener && typeof w.opener !== "undefined") {
      api = findAPIInWindow(w.opener);
    }
    // prova top.opener (alcuni LMS)
    if (!api && w.top && w.top.opener) {
      api = findAPIInWindow(w.top.opener);
    }
    return api;
  }

  SCORM.init = function () {
    if (SCORM.isActive) return true;
    SCORM.handle = getAPI();
    if (!SCORM.handle) { log("API LMS non trovata — modalità standalone."); return false; }

    var ok;
    if (SCORM.version === "2004") {
      ok = SCORM.handle.Initialize("");
    } else {
      ok = SCORM.handle.LMSInitialize("");
    }
    ok = (ok + "") === "true";

    if (ok) {
      SCORM.isActive = true;
      log("Inizializzato. Versione:", SCORM.version);
    } else {
      // SCORM 2004: codice 103 = "Already Initialized" → la sessione è
      // comunque utilizzabile (alcuni LMS la pre-inizializzano).
      var err = SCORM.getLastError();
      if (SCORM.version === "2004" && err === "103") {
        SCORM.isActive = true;
        log("Sessione già inizializzata dall'LMS (err 103): utilizzabile.");
      } else {
        log("Init fallita. Errore:", err);
      }
    }
    return SCORM.isActive;
  };

  SCORM.get = function (param) {
    if (!SCORM.handle || !SCORM.isActive) return "";
    var val = SCORM.version === "2004"
      ? SCORM.handle.GetValue(param)
      : SCORM.handle.LMSGetValue(param);
    return val == null ? "" : val + "";
  };

  SCORM.set = function (param, value) {
    if (!SCORM.handle || !SCORM.isActive) return false;
    var ok = SCORM.version === "2004"
      ? SCORM.handle.SetValue(param, value + "")
      : SCORM.handle.LMSSetValue(param, value + "");
    ok = (ok + "") === "true";
    if (!ok) log("set fallito:", param, "=", value, "err", SCORM.getLastError());
    return ok;
  };

  SCORM.save = function () {
    if (!SCORM.handle || !SCORM.isActive) return false;
    var ok = SCORM.version === "2004" ? SCORM.handle.Commit("") : SCORM.handle.LMSCommit("");
    return (ok + "") === "true";
  };

  SCORM.quit = function () {
    if (!SCORM.handle || !SCORM.isActive) return false;
    SCORM.save();
    var ok = SCORM.version === "2004" ? SCORM.handle.Terminate("") : SCORM.handle.LMSFinish("");
    ok = (ok + "") === "true";
    if (ok) SCORM.isActive = false;
    return ok;
  };

  SCORM.getLastError = function () {
    if (!SCORM.handle) return "0";
    return (SCORM.version === "2004" ? SCORM.handle.GetLastError() : SCORM.handle.LMSGetLastError()) + "";
  };

})(window);
