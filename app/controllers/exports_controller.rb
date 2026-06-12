class ExportsController < ApplicationController
  def new
    assign_default_period
  end

  def create
    @from, @to = export_period

    if params[:download].present?
      download_markdown
    else
      @markdown = export_markdown(@from, @to)
      render :new
    end
  rescue ArgumentError
    @from = params[:from].presence || default_from
    @to = params[:to].presence || Date.current
    @markdown = params[:markdown]
    flash.now[:alert] = "Choisis une période valide."
    render :new, status: :unprocessable_entity
  end

  private

  def assign_default_period
    @from = default_from
    @to = Date.current
  end

  def default_from
    30.days.ago.to_date
  end

  def export_period
    from = Date.iso8601(params[:from])
    to = Date.iso8601(params[:to])
    raise ArgumentError if from > to

    [ from, to ]
  end

  def download_markdown
    markdown = params[:markdown].to_s

    case params[:download]
    when "markdown"
      send_data markdown,
        filename: export_filename("md"),
        type: "text/markdown; charset=utf-8"
    when "pdf"
      send_data MarkdownToPdfRenderer.new.render(markdown),
        filename: export_filename("pdf"),
        type: "application/pdf",
        disposition: "attachment"
    else
      raise ArgumentError
    end
  end

  def export_markdown(from, to)
    entries = Current.user.journal_entries
      .where(entry_date: from..to)
      .includes(:meals)
      .order(:entry_date)

    render_to_string(
      template: "exports/export",
      formats: [ :text ],
      locals: { entries:, from:, to: }
    )
  end

  def export_filename(extension)
    "repas_#{@from}_#{@to}.#{extension}"
  end
end
