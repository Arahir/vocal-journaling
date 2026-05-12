require "net/http"
require "json"
require "base64"

class OpenRouterClient
  class Error < StandardError; end

  CHAT_ENDPOINT = URI("https://openrouter.ai/api/v1/chat/completions")
  TRANSCRIPTIONS_ENDPOINT = URI("https://openrouter.ai/api/v1/audio/transcriptions")
  DEFAULT_MODEL = "anthropic/claude-sonnet-4"
  DEFAULT_TRANSCRIPTION_MODEL = "openai/whisper-large-v3-turbo"
  MEAL_TYPES = %w[breakfast lunch dinner snack other].freeze
  PRIMARY_TYPES = %w[breakfast lunch dinner].freeze

  def self.model
    ENV.fetch("OPENROUTER_MODEL", DEFAULT_MODEL)
  end

  def self.transcription_model
    ENV.fetch("OPENROUTER_TRANSCRIPTION_MODEL", DEFAULT_TRANSCRIPTION_MODEL)
  end

  def analyze(raw_text)
    return { summary: "", meals: [] } if raw_text.blank?

    content = request_analysis(raw_text)
    parse_content(content)
  end

  def transcribe_audio(data:, format:, language: "fr")
    raise Error, "Audio vide" if data.blank?
    raise Error, "Format audio manquant" if format.blank?

    body = {
      input_audio: {
        data: Base64.strict_encode64(data),
        format: format
      },
      model: self.class.transcription_model,
      language: language
    }

    parse_transcription_response(post_json(TRANSCRIPTIONS_ENDPOINT, body))
  end

  def parse_content(content)
    parsed = JSON.parse(content, symbolize_names: true)

    {
      summary: parsed[:summary].to_s.strip,
      meals: normalize_meals(parsed[:meals])
    }
  rescue JSON::ParserError => e
    raise Error, "Réponse JSON invalide: #{e.message}"
  end

  def parse_transcription_response(body)
    parsed = JSON.parse(body)
    text = parsed["text"].to_s.strip
    raise Error, "Réponse de transcription vide" if text.blank?

    {
      text: text,
      usage: parsed["usage"] || {},
      model: self.class.transcription_model
    }
  rescue JSON::ParserError => e
    raise Error, "Réponse transcription invalide: #{e.message}"
  end

  private
    def request_analysis(raw_text)
      response_body = post_json(CHAT_ENDPOINT, {
        model: self.class.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: raw_text }
        ],
        response_format: { type: "json_object" }
      })

      JSON.parse(response_body).dig("choices", 0, "message", "content").presence ||
        raise(Error, "Réponse OpenRouter sans contenu")
    rescue JSON::ParserError => e
      raise Error, "Réponse OpenRouter invalide: #{e.message}"
    end

    def post_json(endpoint, body)
      api_key = api_key_for(endpoint)

      request = Net::HTTP::Post.new(endpoint)
      request["Authorization"] = "Bearer #{api_key}"
      request["Content-Type"] = "application/json"
      request.body = body.to_json

      response = Net::HTTP.start(endpoint.hostname, endpoint.port, use_ssl: true, read_timeout: timeout) do |http|
        http.request(request)
      end

      unless response.is_a?(Net::HTTPSuccess)
        raise Error, "HTTP #{response.code}: #{response.body.to_s.truncate(300)}"
      end

      response.body
    rescue Timeout::Error, SocketError, SystemCallError => e
      raise Error, e.message
    end

    def api_key_for(endpoint)
      env_key = endpoint == TRANSCRIPTIONS_ENDPOINT ? "OPENROUTER_VOICE_API_KEY" : "OPENROUTER_API_KEY"

      ENV.fetch(env_key) do
        raise Error, "#{env_key} manquante"
      end
    end

    def timeout
      ENV.fetch("OPENROUTER_TIMEOUT", 30).to_i
    end

    def normalize_meals(meals)
      seen_primary = {}

      Array(meals).filter_map do |meal|
        type = meal[:meal_type].to_s
        description = meal[:description].to_s.squish

        next unless type.in?(MEAL_TYPES)
        next if description.blank?

        if type.in?(PRIMARY_TYPES)
          next if seen_primary[type]

          seen_primary[type] = true
        end

        { meal_type: type, description: }
      end
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
    Ne retourne pas plusieurs breakfast, lunch ou dinner. Tu peux retourner plusieurs snack.
  PROMPT
end
