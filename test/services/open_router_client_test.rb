require "test_helper"

class OpenRouterClientTest < ActiveSupport::TestCase
  test "normalizes meals returned by the model" do
    content = {
      summary: "Tu as eu une journée dense.",
      meals: [
        { meal_type: "lunch", description: "riz et légumes" },
        { meal_type: "lunch", description: "doublon ignoré" },
        { meal_type: "snack", description: "pomme" },
        { meal_type: "snack", description: "chocolat" },
        { meal_type: "brunch", description: "type invalide" },
        { meal_type: "dinner", description: "" }
      ]
    }.to_json

    result = OpenRouterClient.new.parse_content(content)

    assert_equal "Tu as eu une journée dense.", result[:summary]
    assert_equal [
      { meal_type: "lunch", description: "riz et légumes" },
      { meal_type: "snack", description: "pomme" },
      { meal_type: "snack", description: "chocolat" }
    ], result[:meals]
  end

  test "accepts analysis JSON wrapped in a markdown code fence" do
    content = <<~CONTENT
      ```json
      {
        "summary": "Tu as testé la dictée.",
        "meals": []
      }
      ```
    CONTENT

    result = OpenRouterClient.new.parse_content(content)

    assert_equal "Tu as testé la dictée.", result[:summary]
    assert_empty result[:meals]
  end

  test "parses transcription response" do
    result = OpenRouterClient.new.parse_transcription_response({
      text: " Bonjour le carnet. ",
      usage: { seconds: 3.2 }
    }.to_json)

    assert_equal "Bonjour le carnet.", result[:text]
    assert_equal({ "seconds" => 3.2 }, result[:usage])
    assert_equal OpenRouterClient.transcription_model, result[:model]
  end

  test "transcription requires the voice api key" do
    original_fetch = ENV.method(:fetch)
    ENV.define_singleton_method(:fetch) do |key, *args, &block|
      key == "OPENROUTER_VOICE_API_KEY" ? block.call : "present"
    end

    begin
      error = assert_raises(OpenRouterClient::Error) do
        OpenRouterClient.new.transcribe_audio(data: "audio", format: "webm")
      end

      assert_equal "OPENROUTER_VOICE_API_KEY manquante", error.message
    ensure
      ENV.define_singleton_method(:fetch) { |*args, **kwargs, &block| original_fetch.call(*args, **kwargs, &block) }
    end
  end
end
