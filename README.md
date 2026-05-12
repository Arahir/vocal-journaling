# Journal vocal

POC Rails 8 de journaling vocal local avec login, dictée Web Speech API, résumé LLM via OpenRouter et export Markdown des repas.

## Setup

```sh
bundle install
bin/rails db:prepare
cp .env.example .env
```

Remplir ensuite `OPENROUTER_API_KEY` dans `.env`.

Le modèle utilisé est visible dans l'UI. Par défaut :

```sh
OPENROUTER_MODEL=anthropic/claude-sonnet-4
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

## Tests

```sh
bin/rails test
```
