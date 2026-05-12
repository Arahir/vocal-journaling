class JournalEntry < ApplicationRecord
  belongs_to :user
  has_many :meals, dependent: :destroy

  validates :entry_date, presence: true, uniqueness: { scope: :user_id }

  def self.for_user_and_date(user, date)
    user.journal_entries.find_or_create_by!(entry_date: date)
  end

  def processed?
    processed_at.present?
  end

  def needs_processing?
    raw_text.present? && (processed_at.blank? || updated_at > processed_at)
  end

  def summary_excerpt
    return "Non traitée" if summary.blank?

    summary.split(/[.!?]/).first.to_s.strip.presence || summary.truncate(120)
  end
end
