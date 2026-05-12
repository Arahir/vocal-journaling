require "test_helper"

class TranscriptionsControllerTest < ActionDispatch::IntegrationTest
  test "requires an audio upload" do
    sign_in_as users(:one)

    post transcription_path

    assert_response :unprocessable_entity
    assert_equal "Audio manquant", JSON.parse(response.body).fetch("error")
  end

  test "returns transcribed text" do
    sign_in_as users(:one)
    tempfile = Tempfile.new([ "dictation", ".webm" ])
    tempfile.binmode
    tempfile.write("fake audio")
    tempfile.rewind

    fake_client = Object.new
    def fake_client.transcribe_audio(data:, format:, language:)
      raise "wrong format" unless format == "webm"
      raise "wrong language" unless language == "fr"
      raise "missing data" if data.blank?

      { text: "Texte dicté.", usage: { "seconds" => 1.0 }, model: "openai/whisper-large-v3-turbo" }
    end

    original_new = OpenRouterClient.method(:new)
    OpenRouterClient.define_singleton_method(:new) { fake_client }

    begin
      post transcription_path, params: {
        audio: Rack::Test::UploadedFile.new(tempfile.path, "audio/webm")
      }
    ensure
      OpenRouterClient.define_singleton_method(:new) { |*args, **kwargs| original_new.call(*args, **kwargs) }
    end

    assert_response :success
    assert_equal "Texte dicté.", JSON.parse(response.body).fetch("text")
  ensure
    tempfile&.close!
  end
end
