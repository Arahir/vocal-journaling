class CreateMeals < ActiveRecord::Migration[8.1]
  def change
    create_table :meals do |t|
      t.references :journal_entry, null: false, foreign_key: true
      t.integer :meal_type, null: false
      t.text :description, null: false

      t.timestamps
    end

    add_index :meals, [ :journal_entry_id, :meal_type ],
      unique: true,
      where: "meal_type IN (0, 1, 2)",
      name: "index_meals_on_entry_and_primary_type"
  end
end
