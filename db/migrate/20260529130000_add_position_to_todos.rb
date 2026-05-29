class AddPositionToTodos < ActiveRecord::Migration[8.1]
  def up
    add_column :todos, :position, :integer

    # Backfill existing rows per user, oldest first.
    Todo.reset_column_information
    Todo.group(:user_id).pluck(:user_id).each do |user_id|
      Todo.where(user_id: user_id).order(:created_at, :id).each_with_index do |todo, index|
        todo.update_column(:position, index)
      end
    end

    change_column_null :todos, :position, false, 0
    add_index :todos, [ :user_id, :position ]
  end

  def down
    remove_index :todos, [ :user_id, :position ]
    remove_column :todos, :position
  end
end
