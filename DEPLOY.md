# Pubblicare il MOOC su GitHub + Vercel

Tempo stimato: 10 minuti. Una volta connesso GitHub a Vercel, ogni `git push` rideploya automaticamente.

## Prerequisiti

- Account GitHub: https://github.com/signup (gratuito)
- Account Vercel: https://vercel.com/signup (gratuito — accedi con GitHub per saltare uno step)
- Git installato sul Mac: `xcode-select --install` oppure verifica con `git --version`

## Passo 1 — Crea il repository su GitHub

1. Vai su https://github.com/new
2. Repository name: `mooc-ia-inclusiva` (o quello che preferisci)
3. Visibility: **Public** (necessario per il piano Vercel Hobby gratuito) oppure Private
4. **NON** spuntare "Add a README" / "Add .gitignore" / "Choose a license" — abbiamo già tutto
5. Clicca **Create repository**
6. Nella schermata successiva, copia l'URL HTTPS del repo (es. `https://github.com/TUO_USER/mooc-ia-inclusiva.git`)

## Passo 2 — Push del sito da terminale

Apri Terminale sul Mac e copia ognuno di questi comandi. Sostituisci `TUO_USER` con il tuo username GitHub.

```bash
cd "/Users/antonioscaramuzzino/Library/CloudStorage/GoogleDrive-antonio.scaramuzzino@coopinrete.it/Drive condivisi/Antonio Scaramuzzino/Corsi/Corso IA come co-pilota nella progettazione della didattica inclusiva/MOOC/mooc-publish"

git init
git add -A
git commit -m "Initial commit: MOOC IA inclusiva v17"
git branch -M main
git remote add origin https://github.com/TUO_USER/mooc-ia-inclusiva.git
git push -u origin main
```

Alla prima `git push` GitHub ti chiede di autenticarti. Le opzioni più comode:
- **Login via browser** (GitHub CLI installato: `brew install gh && gh auth login`)
- **Personal Access Token**: https://github.com/settings/tokens/new (seleziona scope `repo`)
  - Quando git chiede password, incolla il token (NON la password GitHub vera)

## Passo 3 — Deploy su Vercel (un click)

1. Vai su https://vercel.com/new
2. **Sign in with GitHub** (se non sei già loggato)
3. Vercel mostra la lista dei tuoi repository GitHub. Trova `mooc-ia-inclusiva` e clicca **Import**
4. Lascia tutte le impostazioni di default:
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: (vuoto)
   - Output Directory: (vuoto — il sito è già statico)
5. Clicca **Deploy**

In ~30 secondi Vercel ti darà l'URL pubblico, es. `mooc-ia-inclusiva.vercel.app`.

## Aggiornamenti successivi

Ogni volta che modifichi i contenuti del MOOC:

```bash
cd "/Users/antonioscaramuzzino/.../MOOC/mooc-publish"
git add -A
git commit -m "Aggiornamento: <descrizione>"
git push
```

Vercel rideploya automaticamente in ~30 secondi.

## Dominio personalizzato (opzionale)

Su Vercel → tuo progetto → **Settings → Domains** → aggiungi `mooc.tuoindirizzo.it` (richiede DNS configurato).

## Note tecniche

- Dimensione del sito: ~279 MB (gli audio occupano la maggior parte)
- File più grande: `05-inclusione-valutazione/audio.m4a` (44 MB) — dentro il limite GitHub di 100 MB/file
- Vercel Hobby plan: 100 GB di bandwidth/mese gratuita, sufficienti per centinaia di studenti
