# POC — App de journaling vocal (Rails + Hotwire + Stimulus)

App web mono-utilisateur, hébergement local, données dans SQLite. Le but est de pouvoir dicter (ou taper) au fil de la journée, demander à un LLM d'organiser le tout, et exporter les repas sur une période.

---

## Stack

- **Backend** : Rails 8 (mode `--minimal` pas nécessaire, on garde les défauts)
- **Frontend** : Hotwire (Turbo + Stimulus) avec ERB
- **CSS** : `tailwindcss-rails`
- **JS** : importmap (suffit largement pour Stimulus + Web Speech API)
- **DB** : SQLite (défaut Rails 8, production-grade)
- **LLM** : OpenRouter (HTTP via `Net::HTTP` ou `Faraday`)
- **Dictée vocale** : Web Speech API (navigateur, gratuit, FR natif)

> Rationale : Rails 8 + SQLite = zéro infra (pas de Redis grâce à Solid Queue/Cache si jamais on en ajoute). Hotwire évite tout framework SPA pour 3 pages. Stimulus est parfait pour encapsuler la Web Speech API.

---

## Modèle de données

### `journal_entries`
| Champ | Type | Notes |
|---|---|---|
| id | bigint PK | |
| entry_date | date | index unique, une seule entrée par jour |
| raw_text | text nullable | dicté + tapé |
| summary | text nullable | généré par le LLM |
| processed_at | datetime nullable | dernière exécution LLM |
| timestamps | | |

### `meals`
| Champ | Type | Notes |
|---|---|---|
| id | bigint PK | |
| journal_entry_id | FK | `null: false`, `dependent: :destroy` côté model |
| meal_type | integer | enum Rails : `breakfast/lunch/dinner/snack/other` |
| description | text | court, généré par le LLM |
| timestamps | | |

```ruby
class JournalEntry < ApplicationRecord
  has_many :meals, dependent: :destroy
  validates :entry_date, presence: true, uniqueness: true

  def self.for_date(date)
    find_or_create_by(entry_date: date)
  end

  def processed? = processed_at.present?
end

class Meal < ApplicationRecord
  belongs_to :journal_entry
  enum :meal_type, { breakfast: 0, lunch: 1, dinner: 2, snack: 3, other: 4 }
end
```

**Règle d'idempotence** : à chaque appel `process`, on `meals.destroy_all` puis on recrée à partir de la réponse LLM. Pas de diff.

---

## Routes

```ruby
Rails.application.routes.draw do
  root to: "entries#today"

  resources :entries, only: [:show, :update], param: :date do
    member do
      post :process_with_llm
    end
  end

  get  "history", to: "history#index"
  get  "export",  to: "exports#new"
  post "export",  to: "exports#create"
end
```

Le `param: :date` permet d'avoir `/entries/2026-05-12` plutôt que des IDs opaques. Le controller fait `JournalEntry.find_by!(entry_date: params[:date])`.

---

## Pages

### `/` → redirige vers `/entries/{today}`
### `/entries/{date}` — éditeur
- `find_or_create_by(entry_date:)` pour ne jamais 404 sur une date passée.
- **Textarea** liée à `raw_text` (autosave debounce 1s via Stimulus).
- **Bouton micro** : démarre/arrête la dictée, append le résultat final au textarea (curseur à la fin).
- **Indicateur visuel** d'écoute en cours (bordure rouge pulsée par ex.).
- **Bouton "Envoyer au LLM"** → POST `process_with_llm`, retourne un **Turbo Stream** qui remplace le frame `summary`.
- Si `summary` existant : `<turbo-frame id="summary">` affiche le résumé + la liste des `meals`.
- Liens : "Historique" / "Export".

### `/history`
- Liste paginée (50/page, on peut juste utiliser `.limit(50).offset(...)` sans gem au début).
- Affiche : date + 1ère phrase du `summary` (ou "non traitée").
- Clic → `/entries/{date}` (même UI, édition rétroactive).

### `/export`
- 2 champs `<input type="date">` (from / to, défaut = -30j → today).
- Bouton "Télécharger" → POST `/export`, renvoie un `.md` via `send_data`.
- Format de sortie (groupé par jour, ordre chrono asc) :

```markdown
# Repas du 2026-05-10 au 2026-05-12

## 2026-05-10
- **Petit-déj** : café, tartine beurre
- **Déj** : salade composée poulet quinoa
- **Dîner** : pâtes carbonara
- **Snack** : yaourt, pomme

## 2026-05-11
...
```

Jours sans entrée ou sans repas : omis.

---

## Hotwire — flow détaillé

### Autosave du raw_text
```erb
<%= form_with model: @entry, url: entry_path(@entry.entry_date), method: :patch,
              data: { controller: "autosave", autosave_url_value: entry_path(@entry.entry_date) } do |f| %>
  <%= f.text_area :raw_text,
        data: { autosave_target: "field", action: "input->autosave#schedule" },
        class: "w-full h-64 ..." %>
<% end %>
```

Stimulus `autosave_controller.js` :
- Debounce 1s.
- `fetch` PATCH avec le contenu, header `Accept: text/vnd.turbo-stream.html`.
- Le controller Rails répond avec un Turbo Stream qui peut mettre à jour un indicateur "Sauvegardé à HH:MM".

### Envoi au LLM
Bouton :
```erb
<%= button_to "Envoyer au LLM", process_with_llm_entry_path(@entry.entry_date),
              data: { turbo_frame: "summary" } %>
```

`EntriesController#process_with_llm` :
- Récupère l'entry, appelle `OpenRouterClient.new.analyze(entry.raw_text)`.
- Persist `summary`, `processed_at`, recrée les `meals`.
- Répond en `turbo_stream` qui remplace le frame `summary`.

```ruby
def process_with_llm
  @entry = JournalEntry.find_by!(entry_date: params[:date])
  result = OpenRouterClient.new.analyze(@entry.raw_text)

  ApplicationRecord.transaction do
    @entry.update!(summary: result[:summary], processed_at: Time.current)
    @entry.meals.destroy_all
    result[:meals].each { @entry.meals.create!(meal_type: _1[:meal_type], description: _1[:description]) }
  end

  respond_to do |format|
    format.turbo_stream { render turbo_stream: turbo_stream.replace("summary", partial: "entries/summary", locals: { entry: @entry }) }
    format.html { redirect_to entry_path(@entry.entry_date) }
  end
end
```

---

## Stimulus — Web Speech API

`app/javascript/controllers/voice_recognition_controller.js` :

```js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["textarea", "button", "indicator"]

  connect() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      this.buttonTarget.disabled = true
      this.buttonTarget.title = "Dictée non supportée (essaie Chrome ou Safari)"
      return
    }
    this.recognition = new SR()
    this.recognition.lang = "fr-FR"
    this.recognition.continuous = true
    this.recognition.interimResults = false
    this.recognition.onresult = (e) => this.handleResult(e)
    this.recognition.onend = () => { if (this.listening) this.recognition.start() }
    this.listening = false
  }

  toggle() {
    if (this.listening) {
      this.listening = false
      this.recognition.stop()
      this.indicatorTarget.classList.remove("animate-pulse", "text-red-600")
    } else {
      this.listening = true
      this.recognition.start()
      this.indicatorTarget.classList.add("animate-pulse", "text-red-600")
    }
  }

  handleResult(event) {
    const transcript = Array.from(event.results)
      .slice(event.resultIndex)
      .filter(r => r.isFinal)
      .map(r => r[0].transcript)
      .join(" ")
    if (!transcript) return

    const ta = this.textareaTarget
    const sep = ta.value && !ta.value.endsWith(" ") ? " " : ""
    ta.value = ta.value + sep + transcript
    ta.dispatchEvent(new Event("input", { bubbles: true })) // trigger autosave
  }
}
```

Markup correspondant :
```erb
<div data-controller="voice-recognition">
  <%= f.text_area :raw_text, data: { voice_recognition_target: "textarea", ... } %>
  <button type="button"
          data-voice-recognition-target="button"
          data-action="voice-recognition#toggle">🎙️</button>
  <span data-voice-recognition-target="indicator">●</span>
</div>
```

Note : Firefox ne supporte pas la Web Speech API, le bouton se désactive proprement avec un title explicite.

---

## Service `OpenRouterClient`

`app/services/open_router_client.rb` :

```ruby
class OpenRouterClient
  ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"

  def analyze(raw_text)
    return { summary: "", meals: [] } if raw_text.blank?

    response = Faraday.post(ENDPOINT) do |req|
      req.headers["Authorization"] = "Bearer #{ENV.fetch('OPENROUTER_API_KEY')}"
      req.headers["Content-Type"]  = "application/json"
      req.options.timeout = 30
      req.body = {
        model: ENV.fetch("OPENROUTER_MODEL", "anthropic/claude-sonnet-4"),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: raw_text }
        ],
        response_format: { type: "json_object" }
      }.to_json
    end

    content = JSON.parse(response.body).dig("choices", 0, "message", "content")
    parsed  = JSON.parse(content, symbolize_names: true)
    {
      summary: parsed[:summary].to_s,
      meals:   Array(parsed[:meals]).map { |m| { meal_type: m[:meal_type], description: m[:description] } }
    }
  rescue JSON::ParserError, Faraday::Error => e
    Rails.logger.error("OpenRouter failure: #{e.message}")
    { summary: "", meals: [] }
  end

  SYSTEM_PROMPT = <<~PROMPT.freeze
    Tu reçois le texte brut d'une journée de journaling alimentaire et émotionnel
    d'un utilisateur francophone. Ton rôle est de l'organiser.

    Retourne UNIQUEMENT un JSON valide, sans markdown, sans texte hors JSON,
    suivant exactement ce schéma :

    {
      "summary": "résumé de la journée en 3 à 5 phrases : humeur dominante,
                  événements marquants, énergie ressentie. Ton neutre,
                  à la 2e personne du singulier.",
      "meals": [
        {
          "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | "other",
          "description": "description courte du repas, 1 ligne max"
        }
      ]
    }

    Si aucun repas n'est mentionné, retourne "meals": [].
    Si le texte est trop vague pour un résumé, retourne "summary": "".
  PROMPT
end
```

Ajouter `gem "faraday"` au Gemfile.

---

## `.env` / credentials

Rails 8 préfère les **encrypted credentials** (`bin/rails credentials:edit`). Mais pour un POC local, un fichier `.env` via `dotenv-rails` est plus rapide :

```
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

Ajouter `gem "dotenv-rails", groups: [:development, :test]`.

---

## Export markdown

```ruby
class ExportsController < ApplicationController
  def new
    @from = 30.days.ago.to_date
    @to   = Date.current
  end

  def create
    from = Date.parse(params[:from])
    to   = Date.parse(params[:to])
    entries = JournalEntry.where(entry_date: from..to).includes(:meals).order(:entry_date)

    markdown = render_to_string(template: "exports/export", formats: [:text],
                                locals: { entries:, from:, to: })
    send_data markdown,
              filename: "repas_#{from}_#{to}.md",
              type: "text/markdown"
  end
end
```

`app/views/exports/export.text.erb` : itération sur entries, skip si pas de meals.

---

## Étapes d'implémentation (pour Claude Code)

1. `rails new journaling-poc --css tailwind --javascript importmap` (Rails 8, SQLite par défaut).
2. `bin/rails g model JournalEntry entry_date:date:uniq raw_text:text summary:text processed_at:datetime`
3. `bin/rails g model Meal journal_entry:references meal_type:integer description:text`
4. `bin/rails db:migrate`
5. Définir l'enum `meal_type` et les relations dans les models.
6. Générer les controllers : `bin/rails g controller Entries show update process_with_llm`, `History index`, `Exports new create`.
7. Définir les routes (voir plus haut).
8. Vues ERB + partial `_summary.html.erb` dans un `<turbo-frame id="summary">`.
9. Stimulus controllers : `voice_recognition`, `autosave`.
10. Service `OpenRouterClient`, ajouter `faraday` et `dotenv-rails` au Gemfile.
11. Optionnel : seeder `db/seeds.rb` avec 2-3 jours fictifs pour tester l'UI hors LLM.

---

## Hors scope (POC)

- Authentification (mono-utilisateur, local)
- Tests automatisés
- Background jobs (l'appel LLM est synchrone, < 5s sur Sonnet)
- PWA / offline
- Sync multi-appareils
- Rappels / notifications
- Mobile-first poussé
- Recherche full-text
- Édition manuelle des `meals` (passer par re-process du raw_text)
- Suppression d'entrées (via `bin/rails console`)

---

## Notes opérationnelles

- **Backup** : `storage/*.sqlite3` (Rails 8 met la DB dans `storage/`). Un cron `cp` suffit.
- **Coût LLM** : ~1 appel/jour, quelques centaines de tokens → centimes/mois.
- **Web Speech `onend`** : sur Chrome, la reconnaissance s'arrête après quelques secondes de silence. Le `onend` ci-dessus la relance tant que `listening = true`, sinon l'utilisateur a l'impression que ça décroche tout seul.
- **HTTPS** : requis en prod pour Web Speech API, mais `localhost` en HTTP fonctionne.
