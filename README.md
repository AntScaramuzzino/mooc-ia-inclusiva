# MOOC — L'IA come co-pilota nella progettazione della didattica inclusiva

Sito web statico del MOOC della rete di scuole, edizione 2026.

**Autore**: prof. Antonio Scaramuzzino
**Durata**: ~6 ore di studio attivo, self-paced
**Moduli**: 5
**Lingua**: italiano

## Contenuti

- 5 dispense (~28.000 parole)
- 5 podcast Audio Overview NotebookLM (~1h 30min totali)
- 75 slide (15 per modulo)
- 5 quiz autovalutativi
- 25 flashcard di ripasso
- Glossario con 110 termini
- Bibliografia con riferimenti normativi e scientifici

## Come visualizzare in locale

Apri `index.html` con qualsiasi browser moderno. Non è richiesto un server (il sito è 100% statico).

## Deploy su Vercel

Il file `vercel.json` configura header di caching ottimizzati per audio, immagini e HTML. Per il deploy collega il repository GitHub a Vercel — il deploy parte automaticamente a ogni push su `main`.

## Stack tecnico

- Generato con [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)
- UI custom in stile Coursera (sidebar collassabile, item-level completion tracking)
- Progress salvato in localStorage del browser (nessun backend)
- Glossario interattivo con popup definizioni inline

## Licenza

Contenuti © 2026 dei rispettivi autori e degli istituti della rete. Riproduzione consentita per uso didattico citando la fonte.
