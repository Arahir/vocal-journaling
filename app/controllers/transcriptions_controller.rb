class TranscriptionsController < ApplicationController
  MAX_AUDIO_BYTES = 25.megabytes
  FORMATS_BY_CONTENT_TYPE = {
    "audio/webm" => "webm",
    "video/webm" => "webm",
    "audio/mp4" => "mp4",
    "audio/mpeg" => "mp3",
    "audio/wav" => "wav",
    "audio/x-wav" => "wav",
    "audio/ogg" => "ogg",
    "audio/flac" => "flac",
    "audio/aac" => "aac",
    "audio/x-m4a" => "m4a",
    "audio/m4a" => "m4a"
  }.freeze

  FORMATS_BY_EXTENSION = {
    ".webm" => "webm",
    ".mp4" => "mp4",
    ".mp3" => "mp3",
    ".wav" => "wav",
    ".ogg" => "ogg",
    ".flac" => "flac",
    ".aac" => "aac",
    ".m4a" => "m4a"
  }.freeze

  def create
    upload = params[:audio]
    return render_error("Audio manquant") unless upload.respond_to?(:read)

    data = upload.read
    return render_error("Audio vide") if data.blank?
    return render_error("Audio trop volumineux") if data.bytesize > MAX_AUDIO_BYTES

    result = OpenRouterClient.new.transcribe_audio(
      data: data,
      format: audio_format(upload),
      language: "fr"
    )

    render json: result
  rescue OpenRouterClient::Error => e
    Rails.logger.error("OpenRouter transcription failure: #{e.message}")
    render_error("Transcription impossible : #{e.message}", status: :bad_gateway)
  end

  private
    def audio_format(upload)
      content_type = upload.content_type.to_s.split(";").first
      FORMATS_BY_CONTENT_TYPE[content_type] ||
        FORMATS_BY_EXTENSION[File.extname(upload.original_filename.to_s).downcase] ||
        "webm"
    end

    def render_error(message, status: :unprocessable_entity)
      render json: { error: message }, status: status
    end
end
