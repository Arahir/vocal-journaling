require "test_helper"

class ExportsControllerTest < ActionDispatch::IntegrationTest
  test "exports only meals from the signed-in user" do
    user = users(:one)
    sign_in_as(user)

    entry = user.journal_entries.create!(entry_date: Date.new(2026, 5, 13), summary: "ok")
    entry.meals.create!(meal_type: :breakfast, description: "café")
    users(:two).journal_entries.create!(entry_date: Date.new(2026, 5, 13), summary: "nope")
      .meals.create!(meal_type: :breakfast, description: "secret")

    post export_path, params: { from: "2026-05-13", to: "2026-05-13" }

    assert_response :success
    assert_includes response.body, "café"
    assert_not_includes response.body, "secret"
  end
end
