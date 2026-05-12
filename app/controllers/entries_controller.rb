class EntriesController < ApplicationController
  before_action :set_entry, only: %i[show update process_with_llm]

  def today
    redirect_to entry_path(Date.current.iso8601)
  end

  def show
    @openrouter_model = OpenRouterClient.model
    @entry_dates = Current.user.journal_entries.order(:entry_date).pluck(:entry_date).map(&:iso8601)
  end

  def update
    if @entry.update(entry_params)
      @saved_at = Time.current
      respond_to do |format|
        format.turbo_stream { head :no_content }
        format.json { render json: { saved_at: I18n.l(@saved_at, format: :short) } }
        format.html { redirect_to entry_path(@entry.entry_date) }
      end
    else
      respond_to do |format|
        format.json { render json: { errors: @entry.errors.full_messages }, status: :unprocessable_entity }
        format.html { redirect_to entry_path(@entry.entry_date), alert: @entry.errors.full_messages.to_sentence }
      end
    end
  end

  def process_with_llm
    if @entry.raw_text.blank?
      return render_summary(alert: "Ajoute d'abord quelques notes avant de lancer l'analyse.")
    end

    result = OpenRouterClient.new.analyze(@entry.raw_text)

    ApplicationRecord.transaction do
      @entry.update!(summary: result.fetch(:summary), processed_at: Time.current)
      @entry.meals.destroy_all
      result.fetch(:meals).each do |meal|
        @entry.meals.create!(meal_type: meal.fetch(:meal_type), description: meal.fetch(:description))
      end
    end

    @entry.reload
    render_summary(notice: "Résumé généré avec #{OpenRouterClient.model}.")
  rescue OpenRouterClient::Error => e
    Rails.logger.error("OpenRouter failure for entry #{@entry.id}: #{e.message}")
    render_summary(alert: "L'appel LLM a échoué. L'ancien résumé a été conservé.")
  end

  private
    def set_entry
      date = Date.iso8601(params[:date])
      @entry = JournalEntry.for_user_and_date(Current.user, date)
    rescue ArgumentError
      redirect_to root_path, alert: "Date invalide."
    end

    def entry_params
      params.require(:journal_entry).permit(:raw_text)
    end

    def render_summary(notice: nil, alert: nil)
      @openrouter_model = OpenRouterClient.model
      flash.now[:notice] = notice if notice.present?
      flash.now[:alert] = alert if alert.present?

      respond_to do |format|
        format.turbo_stream
        format.html { redirect_to entry_path(@entry.entry_date), notice:, alert: }
      end
    end
end
