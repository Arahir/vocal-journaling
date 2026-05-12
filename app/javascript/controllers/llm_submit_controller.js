import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["button", "label", "spinner", "icon", "status"]

  start() {
    this.buttonTarget.disabled = true
    this.labelTarget.textContent = this.buttonTarget.dataset.loadingLabel
    this.spinnerTarget.classList.remove("hidden")
    this.iconTarget.classList.add("hidden")
    if (this.hasStatusTarget) this.statusTarget.classList.remove("hidden")
  }

  finish() {
    this.buttonTarget.disabled = false
    this.labelTarget.textContent = this.buttonTarget.dataset.idleLabel
    this.spinnerTarget.classList.add("hidden")
    this.iconTarget.classList.remove("hidden")
    if (this.hasStatusTarget) this.statusTarget.classList.add("hidden")
  }
}
