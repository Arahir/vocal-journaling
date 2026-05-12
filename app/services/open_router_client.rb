require "net/http"
require "json"

class OpenRouterClient
  class Error < StandardError; end

  ENDPOINT = URI("https://openrouter.ai/api/v1/chat/completions")
  DEFAULT_MODEL = "anthropic/claude-sonnet-4"
  MEAL_TYPES = %w[breakfast lunch dinner snack other].freeze
  PRIMARY_TYPES = %w[breakfast lunch dinner].freeze

  def self.model
    ENV.fetch("OPENROUTER_MODEL", DEFAULT_MODEL)
  end

  def analyze(raw_text)
    return { summary: "", meals: [] } if raw_text.blank?

    content = request_analysis(raw_text)
    parse_content(content)
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

  private
    def request_analysis(raw_text)
      api_key = ENV.fetch("OPENROUTER_API_KEY") do
        raise Error, "OPENROUTER_API_KEY manquante"
      end

      request = Net::HTTP::Post.new(ENDPOINT)
      request["Authorization"] = "Bearer #{api_key}"
      request["Content-Type"] = "application/json"
      request.body = {
        model: self.class.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: raw_text }
        ],
        response_format: { type: "json_object" }
      }.to_json

      response = Net::HTTP.start(ENDPOINT.hostname, ENDPOINT.port, use_ssl: true, read_timeout: timeout) do |http|
        http.request(request)
      end

      unless response.is_a?(Net::HTTPSuccess)
        raise Error, "HTTP #{response.code}: #{response.body.to_s.truncate(300)}"
      end

      JSON.parse(response.body).dig("choices", 0, "message", "content").presence ||
        raise(Error, "Réponse OpenRouter sans contenu")
    rescue JSON::ParserError => e
      raise Error, "Réponse OpenRouter invalide: #{e.message}"
    rescue Timeout::Error, SocketError, SystemCallError => e
      raise Error, e.message
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
