import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["display", "form", "input"]

  edit() {
    this.displayTarget.classList.add("hidden")
    this.formTarget.classList.remove("hidden")
    this.inputTarget.focus()
    const length = this.inputTarget.value.length
    this.inputTarget.setSelectionRange(length, length)
  }

  keydown(event) {
    if (event.key === "Escape") {
      event.preventDefault()
      this.cancel()
    }
  }

  cancel() {
    this.inputTarget.value = this.inputTarget.dataset.original
    this.formTarget.classList.add("hidden")
    this.displayTarget.classList.remove("hidden")
  }
}
