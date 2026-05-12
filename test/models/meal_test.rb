require "test_helper"

class MealTest < ActiveSupport::TestCase
  test "allows several snacks for the same day" do
    entry = journal_entries(:one)

    first = entry.meals.create!(meal_type: :snack, description: "pomme")
    second = entry.meals.build(meal_type: :snack, description: "yaourt")

    assert_predicate first, :persisted?
    assert_predicate second, :valid?
  end

  test "rejects duplicate primary meal for the same day" do
    entry = journal_entries(:one)
    entry.meals.create!(meal_type: :dinner, description: "soupe")

    duplicate = entry.meals.build(meal_type: :dinner, description: "pâtes")

    assert_not duplicate.valid?
  end
end
