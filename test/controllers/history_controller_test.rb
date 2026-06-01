require "test_helper"

class HistoryControllerTest < ActionDispatch::IntegrationTest
  setup { sign_in_as users(:one) }

  test "shows meal-only processed entries as analyzed" do
    entry = users(:one).journal_entries.create!(
      entry_date: Date.new(2026, 5, 13),
      raw_text: "Au déjeuner, omelette aux herbes.",
      summary: "",
      processed_at: Time.current
    )
    entry.meals.create!(meal_type: :lunch, description: "omelette aux herbes")

    get history_path

    assert_response :success
    assert_includes response.body, "Déj : omelette aux herbes"
    assert_not_includes response.body, "Brouillon, non traité"
    assert_not_includes response.body, "non traité"
  end

  test "shows processed entries without generated content as analyzed" do
    users(:one).journal_entries.create!(
      entry_date: Date.new(2026, 5, 13),
      raw_text: "Texte trop vague.",
      summary: "",
      processed_at: Time.current
    )

    get history_path

    assert_response :success
    assert_includes response.body, "Aucun contenu structuré détecté"
    assert_not_includes response.body, "Brouillon, non traité"
  end
end
