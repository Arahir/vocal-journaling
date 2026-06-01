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

  def generated_content?
    summary.present? || meals.any?
  end

  def history_processed?
    processed? || generated_content?
  end

  def summary_excerpt
    return meal_excerpt if summary.blank?

    summary.split(/[.!?]/).first.to_s.strip.presence || summary.truncate(120)
  end

  private
    def meal_excerpt
      first_meal = meals.ordered_for_display.first
      return "#{Meal.french_label(first_meal.meal_type)} : #{first_meal.description}" if first_meal
      return "Aucun contenu structuré détecté" if processed?

      "Brouillon, non traité"
    end
end
