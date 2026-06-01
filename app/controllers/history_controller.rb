class HistoryController < ApplicationController
  PER_PAGE = 50

  def index
    @page = [ params.fetch(:page, 1).to_i, 1 ].max
    scope = Current.user.journal_entries.order(entry_date: :desc)
    @entries_count = scope.count
    @entries = scope.includes(:meals).limit(PER_PAGE).offset((@page - 1) * PER_PAGE)
    @has_next_page = scope.offset(@page * PER_PAGE).exists?
  end
end
