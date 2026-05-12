# Handoff design — Journal vocal

Package de livraison à fournir à l'agent de code (Rails 8 + ERB + Tailwind + Stimulus).

## Décisions de design (fixées par le designer)

| Sujet         | Choix                                                                 | Raison                                                                                  |
|---------------|------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| Typo body     | **Newsreader** (serif chaleureuse, Google Fonts)                       | Renforce la métaphore carnet/Moleskine, lisible en grand, anti-SaaS.                    |
| Typo UI       | **Inter** pour boutons / nav / metadata uniquement                     | Lisibilité en petite taille, contraste de registre avec le serif du corps.              |
| Mono          | **JetBrains Mono**, réservée à la zone d'aperçu d'export.              |                                                                                          |
| Accent        | **Terracotta `#C97B5E`** (default — exposé en tweak pour validation) | Le moins clinique des 3 candidats, lecture la plus chaude.                              |
| Fond          | Crème `#FAF7F2`                                                       | Du brief.                                                                                |
| Encre         | Noir doux `#1F1B16` — jamais de `#000`.                             |                                                                                          |
| Largeur texte | 720 px max, centré.                                                    | Lecture longue confortable, anti-dashboard.                                              |
| Dark mode     | **Hors scope POC** (à confirmer avec PO).                              |                                                                                          |

## Contenu du package

```
handoff/
├─ tailwind.config.js                        ← design tokens
├─ app/
│  ├─ views/
│  │  ├─ layouts/
│  │  │  └─ application.html.erb             ← header minimal + import fonts
│  │  ├─ entries/
│  │  │  ├─ show.html.erb                    ← /entries/:date (vue principale)
│  │  │  └─ _summary.html.erb                ← partial Turbo Frame #summary
│  │  ├─ history/
│  │  │  └─ index.html.erb                   ← /history
│  │  └─ exports/
│  │     └─ new.html.erb                     ← /export
│  ├─ javascript/
│  │  └─ controllers/
│  │     ├─ mic_controller.js                ← Web Speech API + états
│  │     ├─ autosave_controller.js           ← debounce + fetch + indicateur discret
│  │     └─ date_picker_controller.js        ← popover calendrier
│  └─ assets/
│     └─ stylesheets/
│        └─ application.tailwind.css         ← @layer components pour le micro
└─ README.md
```

## Hypothèses sur le backend (à valider avec la spec Rails)

Le designer suppose ces routes — adapter si la spec dit autre chose :

| Méthode | Path                          | Action                                          |
|---------|-------------------------------|-------------------------------------------------|
| GET     | `/`                          | redirige vers `/entries/<today>`              |
| GET     | `/entries/:date`             | éditeur du jour (crée à la volée si absent)    |
| PATCH   | `/entries/:date`             | autosave `raw_text` (renvoie 204 ou Turbo Stream) |
| POST    | `/entries/:date/process`     | déclenche le LLM, render `_summary.html.erb` dans le Turbo Frame |
| GET     | `/history`                   | liste paginée                                   |
| GET     | `/export`                    | formulaire de période                           |
| GET     | `/export.md?from=...&to=...` | téléchargement du markdown                      |

L'objet `@entry` exposé aux vues : `date`, `raw_text`, `summary`, `processed_at`, `meals` (collection avec `meal_type`, `content`, `time_of_day`).

## Anti-patterns rappelés (à ne PAS réintroduire)

- ❌ Toast "Sauvegardé ✓" à chaque frappe — l'indicateur ne sort qu'après 5 s d'inactivité.
- ❌ Spinner plein écran pendant l'appel LLM — c'est inline dans le bouton.
- ❌ Modal de confirmation, sidebar, badges, streaks, gamification.
- ❌ Redirect après l'envoi au LLM — on reste sur la page, le résumé apparaît sous le textarea via Turbo Stream.
- ❌ Icônes décoratives. SVG inline uniquement quand fonctionnel (micro, flèche d'envoi, download).

## Pour le micro

Le bouton micro est rendu en Stimulus. Trois états sont gérés en CSS via `data-mic-state` (`idle` / `listening` / `unsupported`). Voir `mic_controller.js` et le bloc `@layer components` de `application.tailwind.css`.

La dictée doit utiliser `webkitSpeechRecognition` / `SpeechRecognition`, `lang = 'fr-FR'`, `continuous = true`, `interimResults = false` (le brief insiste : pas de résultats intermédiaires qui sautillent).

## Pour l'autosave

`autosave_controller.js` debounce à 800 ms et PATCH la valeur du textarea. L'indicateur "Sauvegardé" n'apparaît qu'après **5 s** sans frappe (du brief). Pas de status visuel pendant la frappe.
