require "test_helper"

class OpenRouterClientTest < ActiveSupport::TestCase
  test "normalizes meals returned by the model" do
    content = {
      summary: "Tu as eu une journée dense.",
      meals: [
        { meal_type: "lunch", description: "riz et légumes" },
        { meal_type: "lunch", description: "doublon ignoré" },
        { meal_type: "snack", description: "pomme" },
        { meal_type: "snack", description: "chocolat" },
        { meal_type: "brunch", description: "type invalide" },
        { meal_type: "dinner", description: "" }
      ]
    }.to_json

    result = OpenRouterClient.new.parse_content(content)

    assert_equal "Tu as eu une journée dense.", result[:summary]
    assert_equal [
      { meal_type: "lunch", description: "riz et légumes" },
      { meal_type: "snack", description: "pomme" },
      { meal_type: "snack", description: "chocolat" }
    ], result[:meals]
  end
end
