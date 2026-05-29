import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"

export default class extends Controller {
  static values = { url: String }

  connect() {
    this.sortable = Sortable.create(this.element, {
      handle: "[data-sortable-handle]",
      animation: 150,
      ghostClass: "is-dragging",
      onEnd: () => this.persist()
    })
  }

  disconnect() {
    this.sortable?.destroy()
    this.sortable = null
  }

  async persist() {
    const ids = Array.from(this.element.children)
      .map((row) => row.dataset.todoId)
      .filter(Boolean)

    await fetch(this.urlValue, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": document.querySelector("meta[name='csrf-token']")?.content || ""
      },
      body: JSON.stringify({ ids })
    })
  }
}
