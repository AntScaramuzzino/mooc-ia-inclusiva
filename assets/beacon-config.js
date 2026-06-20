/* ============================================================
   MOOC BEACON CONFIG
   URL della web app Apps Script che riceve gli eventi di
   "attività completata" e li registra sul tab "Activity Log"
   dello Sheet di certificazione.

   Per attivare:
   1. Aggiorna il progetto Apps Script "app-invio-attestati" con il file
      app-invio-attestati.gs aggiornato (include doPost + activity beacon).
   2. Esegui il nuovo deployment (Esegui il deployment → Nuova versione,
      Web app, Esegui come "Io", Chi ha accesso "Chiunque anche anonimo").
   3. Copia l'URL della web app (finisce con /exec) e incollalo qui sotto.
   4. git commit + push → Vercel ridistribuisce.

   Se BEACON_URL resta vuoto, il MOOC continua a funzionare in modalità
   "honor system" (solo localStorage, niente certificazione verificata).
   ============================================================ */

window.MOOC_BEACON_URL = "";  // es. "https://script.google.com/macros/s/AKfyc.../exec"
