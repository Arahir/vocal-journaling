class ExportsController < ApplicationController
  def new
    @from = 30.days.ago.to_date
    @to = Date.current
  end

  def create
    from = Date.iso8601(params[:from])
    to = Date.iso8601(params[:to])
    raise ArgumentError if from > to

    entries = Current.user.journal_entries
      .where(entry_date: from..to)
      .includes(:meals)
      .order(:entry_date)

    markdown = render_to_string(
      template: "exports/export",
      formats: [ :text ],
      locals: { entries:, from:, to: }
    )

    send_data markdown,
      filename: "repas_#{from}_#{to}.md",
      type: "text/markdown; charset=utf-8"
  rescue ArgumentError
    @from = params[:from].presence || 30.days.ago.to_date
    @to = params[:to].presence || Date.current
    flash.now[:alert] = "Choisis une période valide."
    render :new, status: :unprocessable_entity
  end
end
