/* ============================================================
   MOOC AUTH CONFIG
   Configurazione del login Google e backend di sincronizzazione.
   Se entrambi i campi sono vuoti, il login è DISABILITATO
   e il MOOC funziona solo con localStorage del browser.

   Per attivare il login:
   1. Crea un OAuth 2.0 Web Client su https://console.cloud.google.com
      (Authorized JavaScript origins: https://mooc-ia-inclusiva.vercel.app)
      → copia il "Client ID" qui sotto in `clientId`
   2. Deploy l'Apps Script `backend-progress.gs` come Web App
      (Esegui come: io, Accesso: chiunque anche anonimo)
      → copia l'URL della web app qui sotto in `backendUrl`
   ============================================================ */

window.MOOC_AUTH = {
  clientId: "",        // es. "1234567890-abc...apps.googleusercontent.com"
  backendUrl: "",      // es. "https://script.google.com/macros/s/AKfyc.../exec"
};
