class CreateJournalEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :journal_entries do |t|
      t.references :user, null: false, foreign_key: true
      t.date :entry_date, null: false
      t.text :raw_text
      t.text :summary
      t.datetime :processed_at

      t.timestamps
    end

    add_index :journal_entries, [ :user_id, :entry_date ], unique: true
  end
end
