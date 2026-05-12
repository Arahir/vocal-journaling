require "test_helper"

class JournalEntryTest < ActiveSupport::TestCase
  test "keeps one entry per user and date" do
    existing = journal_entries(:one)
    duplicate = existing.user.journal_entries.build(entry_date: existing.entry_date)

    assert_not duplicate.valid?
  end

  test "allows different users to use the same date" do
    user = User.create!(
      email_address: "three@example.com",
      password: "password",
      password_confirmation: "password"
    )
    entry = user.journal_entries.build(entry_date: journal_entries(:one).entry_date)

    assert_predicate entry, :valid?
  end
end
