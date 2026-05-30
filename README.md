# Journal vocal

POC Rails 8 de journaling vocal local avec login, dictée Web Speech API, résumé LLM via OpenRouter et export Markdown des repas.

## Setup

```sh
bundle install
bin/rails db:prepare
cp .env.example .env
```

Remplir ensuite `OPENROUTER_API_KEY` et `OPENROUTER_VOICE_API_KEY` dans `.env`.

Les modèles utilisés sont configurables. Par défaut :

```sh
OPENROUTER_MODEL=anthropic/claude-sonnet-4
OPENROUTER_TRANSCRIPTION_MODEL=openai/whisper-large-v3-turbo
```

## Lancer l'app

```sh
bin/dev
```

Ou, sans watcher Tailwind :

```sh
bin/rails server
```

Puis ouvrir http://127.0.0.1:3000.

## Déployer sur Fly.io

La configuration Fly utilise une machine partagée 512 MB en région Paris (`cdg`) avec une volume SQLite persistant de 3 GB monté dans `/rails/storage`. Fly termine HTTPS et transmet le trafic à Thruster sur le port interne `8080`. Puma tourne en mode single-process, avec un pool Active Record de 5 connexions pour satisfaire Solid Queue. Le health check Fly attend `/up` après une courte période de grâce, le temps que `db:prepare` termine au démarrage.

```sh
flyctl auth login
flyctl apps create vocal-journaling
flyctl volumes create carnet_data --app vocal-journaling --region cdg --size 3
flyctl secrets set \
  --app vocal-journaling \
  RAILS_MASTER_KEY="$(cat config/master.key)" \
  OPENROUTER_API_KEY="sk-or-v1-..." \
  OPENROUTER_VOICE_API_KEY="sk-or-v1-..."
flyctl deploy --app vocal-journaling
```

Si le nom d'app Fly n'est pas disponible, modifier `app` et `APP_HOST` dans `fly.toml`, puis utiliser ce même nom dans `flyctl apps create`.

## Données de démo

Les seeds ne créent rien par défaut. Pour remplir l'UI avec un compte de démo :

```sh
DEMO_DATA=true bin/rails db:seed
```

Identifiants :

```txt
demo@example.com / password
```

Suppression :

```sh
bin/rails runner "User.find_by(email_address: 'demo@example.com')&.destroy!"
```

## Convertir un export Markdown en PDF

```sh
script/markdown_to_pdf repas.md
script/markdown_to_pdf repas.md repas.pdf
```

Le script utilise Prawn et détecte automatiquement une police Unicode courante.
Pour forcer une police :

```sh
MARKDOWN_TO_PDF_FONT=/path/to/Regular.ttf \
MARKDOWN_TO_PDF_BOLD_FONT=/path/to/Bold.ttf \
script/markdown_to_pdf repas.md
```

## Tests

```sh
bin/rails test
```
