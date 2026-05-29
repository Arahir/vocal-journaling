class Todo < ApplicationRecord
  belongs_to :user

  validates :content, presence: true

  scope :ordered, -> { order(:completed, :position) }

  before_create :assign_position

  def toggle_completed!
    update!(completed: !completed)
  end

  private
    def assign_position
      self.position ||= (user&.todos&.maximum(:position) || -1) + 1
    end
end
