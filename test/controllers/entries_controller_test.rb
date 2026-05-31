require "test_helper"

class EntriesControllerTest < ActionDispatch::IntegrationTest
  setup { sign_in_as users(:one) }

  test "processes a past entry and renders generated meals without a summary" do
    entry = users(:one).journal_entries.create!(
      entry_date: Date.new(2026, 5, 13),
      raw_text: "Au déjeuner, omelette aux herbes."
    )

    stub_analyze(summary: "", meals: [
      { meal_type: "lunch", description: "omelette aux herbes" }
    ]) do
      post process_with_llm_entry_path(entry.entry_date.iso8601), as: :turbo_stream
    end

    assert_response :success
    assert_equal "", entry.reload.summary
    assert_equal [ "omelette aux herbes" ], entry.meals.pluck(:description)
    assert_includes response.body, "Résumé généré avec"
    assert_includes response.body, "Repas"
    assert_includes response.body, "omelette aux herbes"
  end

  test "processes only the requested day" do
    requested = users(:one).journal_entries.create!(
      entry_date: Date.new(2026, 5, 14),
      raw_text: "Dîner soupe."
    )
    today = JournalEntry.for_user_and_date(users(:one), Date.current)

    stub_analyze(summary: "Tu as mangé une soupe.", meals: []) do
      post process_with_llm_entry_path(requested.entry_date.iso8601), as: :turbo_stream
    end

    assert_response :success
    assert_equal "Tu as mangé une soupe.", requested.reload.summary
    assert_not_equal "Tu as mangé une soupe.", today.reload.summary
  end

  private
    def stub_analyze(result)
      fake_client = Object.new
      fake_client.define_singleton_method(:analyze) { |_raw_text| result }

      original_new = OpenRouterClient.method(:new)
      OpenRouterClient.define_singleton_method(:new) { fake_client }
      yield
    ensure
      OpenRouterClient.define_singleton_method(:new) { |*args, **kwargs| original_new.call(*args, **kwargs) }
    end
end
