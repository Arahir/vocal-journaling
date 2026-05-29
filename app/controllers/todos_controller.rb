class TodosController < ApplicationController
  before_action :set_todo, only: %i[update destroy]

  def index
    @openrouter_model = OpenRouterClient.model
    @todos = Current.user.todos.ordered
  end

  def create
    raw_text = params[:raw_text].to_s

    if raw_text.blank?
      return render_index(alert: "Dicte ou écris quelques tâches avant de lancer l'analyse.")
    end

    labels = OpenRouterClient.new.extract_tasks(raw_text)

    if labels.empty?
      return render_index(alert: "Aucune tâche détectée dans ce texte.")
    end

    ApplicationRecord.transaction do
      labels.each { |label| Current.user.todos.create!(content: label) }
    end

    render_index(notice: "#{labels.size} #{"tâche".pluralize(labels.size)} ajoutée#{"s" if labels.size > 1}.", reset_form: true)
  rescue OpenRouterClient::Error => e
    Rails.logger.error("OpenRouter failure while extracting tasks: #{e.message}")
    render_index(alert: "L'appel LLM a échoué. Réessaie dans un instant.")
  end

  def update
    if (content = params.dig(:todo, :content))
      if @todo.update(content: content.strip)
        render_index
      else
        render_index(alert: @todo.errors.full_messages.to_sentence)
      end
    else
      @todo.toggle_completed!
      render_index
    end
  end

  def destroy
    @todo.destroy!
    render_index
  end

  def reorder
    ids = Array(params[:ids]).map(&:to_i)
    todos = Current.user.todos.where(id: ids).index_by(&:id)

    ApplicationRecord.transaction do
      ids.each_with_index do |id, index|
        todos[id]&.update_column(:position, index)
      end
    end

    head :no_content
  end

  private
    def set_todo
      @todo = Current.user.todos.find(params[:id])
    end

    def render_index(notice: nil, alert: nil, reset_form: false)
      @openrouter_model = OpenRouterClient.model
      @todos = Current.user.todos.ordered
      flash.now[:notice] = notice if notice.present?
      flash.now[:alert] = alert if alert.present?

      streams = [
        turbo_stream.replace("flash", partial: "shared/flash"),
        turbo_stream.replace("todos", partial: "todos/list", locals: { todos: @todos })
      ]
      streams << turbo_stream.replace("todo_form", partial: "todos/form") if reset_form

      respond_to do |format|
        format.turbo_stream { render turbo_stream: streams }
        format.html { redirect_to todos_path, notice:, alert: }
      end
    end
end
