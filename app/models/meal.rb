class Meal < ApplicationRecord
  belongs_to :journal_entry

  enum :meal_type, { breakfast: 0, lunch: 1, dinner: 2, snack: 3, other: 4 }

  validates :meal_type, presence: true
  validates :description, presence: true
  validates :meal_type, uniqueness: { scope: :journal_entry_id }, if: :primary_meal?

  PRIMARY_TYPES = %w[breakfast lunch dinner].freeze

  def self.ordered_for_display
    order(Arel.sql("CASE meal_type WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 ELSE 4 END"), :created_at)
  end

  def self.french_label(type)
    {
      "breakfast" => "Petit-déj",
      "lunch" => "Déj",
      "dinner" => "Dîner",
      "snack" => "Snack",
      "other" => "Autre"
    }.fetch(type.to_s, "Autre")
  end

  private
    def primary_meal?
      meal_type.in?(PRIMARY_TYPES)
    end
end
