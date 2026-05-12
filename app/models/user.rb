class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :journal_entries, dependent: :destroy

  validates :email_address, presence: true, uniqueness: true
  normalizes :email_address, with: ->(e) { e.strip.downcase }
end
