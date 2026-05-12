# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_05_12_085453) do
  create_table "journal_entries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.date "entry_date", null: false
    t.datetime "processed_at"
    t.text "raw_text"
    t.text "summary"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id", "entry_date"], name: "index_journal_entries_on_user_id_and_entry_date", unique: true
    t.index ["user_id"], name: "index_journal_entries_on_user_id"
  end

  create_table "meals", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description", null: false
    t.integer "journal_entry_id", null: false
    t.integer "meal_type", null: false
    t.datetime "updated_at", null: false
    t.index ["journal_entry_id", "meal_type"], name: "index_meals_on_entry_and_primary_type", unique: true, where: "meal_type IN (0, 1, 2)"
    t.index ["journal_entry_id"], name: "index_meals_on_journal_entry_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "ip_address"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "updated_at", null: false
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  add_foreign_key "journal_entries", "users"
  add_foreign_key "meals", "journal_entries"
  add_foreign_key "sessions", "users"
end
