require "test_helper"

class ExportsControllerTest < ActionDispatch::IntegrationTest
  test "generates editable markdown preview only from the signed-in user" do
    user = users(:one)
    sign_in_as(user)

    entry = user.journal_entries.create!(entry_date: Date.new(2026, 5, 13), summary: "ok")
    entry.meals.create!(meal_type: :breakfast, description: "café")
    users(:two).journal_entries.create!(entry_date: Date.new(2026, 5, 13), summary: "nope")
      .meals.create!(meal_type: :breakfast, description: "secret")

    post export_path, params: { from: "2026-05-13", to: "2026-05-13" }

    assert_response :success
    assert_select "textarea[name=markdown]"
    assert_includes response.body, "café"
    assert_not_includes response.body, "secret"
  end

  test "downloads edited markdown" do
    sign_in_as(users(:one))

    post export_path, params: {
      from: "2026-05-13",
      to: "2026-05-13",
      markdown: "# Export modifié\n\n- **Déjeuner** : riz",
      download: "markdown"
    }

    assert_response :success
    assert_equal "text/markdown", response.media_type
    assert_includes response.headers["Content-Disposition"], "repas_2026-05-13_2026-05-13.md"
    assert_equal "# Export modifié\n\n- **Déjeuner** : riz", response.body
  end

  test "downloads edited markdown as pdf" do
    sign_in_as(users(:one))

    post export_path, params: {
      from: "2026-05-13",
      to: "2026-05-13",
      markdown: "# Export modifié\n\n- **Déjeuner** : riz",
      download: "pdf"
    }

    assert_response :success
    assert_equal "application/pdf", response.media_type
    assert_includes response.headers["Content-Disposition"], "repas_2026-05-13_2026-05-13.pdf"
    assert response.body.start_with?("%PDF")
  end
end
