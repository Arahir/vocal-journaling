require "test_helper"

class TodosControllerTest < ActionDispatch::IntegrationTest
  setup { sign_in_as users(:one) }

  test "index renders the page" do
    users(:one).todos.create!(content: "Acheter du pain")

    get todos_path

    assert_response :success
    assert_select "h1", "Tâches"
    assert_match "Acheter du pain", response.body
  end

  test "create extracts tasks via the LLM and stores them" do
    stub_extract_tasks([ "Acheter du pain", "Appeler Marie" ]) do
      assert_difference -> { users(:one).todos.count }, 2 do
        post todos_path, params: { raw_text: "faut que j'achète du pain et que j'appelle Marie" },
          as: :turbo_stream
      end
    end

    assert_response :success
    assert_equal %w[Acheter\ du\ pain Appeler\ Marie].sort,
      users(:one).todos.pluck(:content).sort
  end

  test "create with blank text warns and creates nothing" do
    assert_no_difference -> { Todo.count } do
      post todos_path, params: { raw_text: "  " }, as: :turbo_stream
    end

    assert_response :success
    assert_match "Dicte ou écris", response.body
  end

  test "update toggles completion" do
    todo = users(:one).todos.create!(content: "Acheter du pain")

    patch todo_path(todo), as: :turbo_stream

    assert_response :success
    assert todo.reload.completed?
  end

  test "update edits the content inline" do
    todo = users(:one).todos.create!(content: "Acheter du pain")

    patch todo_path(todo), params: { todo: { content: "  Acheter une baguette  " } }, as: :turbo_stream

    assert_response :success
    assert_equal "Acheter une baguette", todo.reload.content
    refute todo.completed?, "editing content must not toggle completion"
  end

  test "update rejects a blank content edit" do
    todo = users(:one).todos.create!(content: "Acheter du pain")

    patch todo_path(todo), params: { todo: { content: "   " } }, as: :turbo_stream

    assert_response :success
    assert_equal "Acheter du pain", todo.reload.content
  end

  test "destroy removes the task" do
    todo = users(:one).todos.create!(content: "Acheter du pain")

    assert_difference -> { Todo.count }, -1 do
      delete todo_path(todo), as: :turbo_stream
    end

    assert_response :success
  end

  test "create appends tasks after existing ones" do
    users(:one).todos.create!(content: "Existante", position: 0)

    stub_extract_tasks([ "Nouvelle" ]) do
      post todos_path, params: { raw_text: "nouvelle tâche" }, as: :turbo_stream
    end

    assert_equal [ "Existante", "Nouvelle" ], users(:one).todos.ordered.pluck(:content)
  end

  test "reorder persists the new positions" do
    a = users(:one).todos.create!(content: "A", position: 0)
    b = users(:one).todos.create!(content: "B", position: 1)
    c = users(:one).todos.create!(content: "C", position: 2)

    patch reorder_todos_path, params: { ids: [ c.id, a.id, b.id ] }, as: :json

    assert_response :no_content
    assert_equal [ "C", "A", "B" ], users(:one).todos.ordered.pluck(:content)
  end

  test "reorder ignores ids belonging to another user" do
    mine = users(:one).todos.create!(content: "A", position: 0)
    theirs = users(:two).todos.create!(content: "B", position: 0)

    patch reorder_todos_path, params: { ids: [ theirs.id, mine.id ] }, as: :json

    assert_response :no_content
    assert_equal 0, theirs.reload.position
  end

  test "cannot touch another user's task" do
    others = users(:two).todos.create!(content: "Privé")

    delete todo_path(others), as: :turbo_stream

    assert_response :not_found
    assert Todo.exists?(others.id)
  end

  private
    def stub_extract_tasks(labels)
      fake_client = Object.new
      fake_client.define_singleton_method(:extract_tasks) { |_raw_text| labels }

      original_new = OpenRouterClient.method(:new)
      OpenRouterClient.define_singleton_method(:new) { fake_client }
      yield
    ensure
      OpenRouterClient.define_singleton_method(:new) { |*args, **kwargs| original_new.call(*args, **kwargs) }
    end
end
