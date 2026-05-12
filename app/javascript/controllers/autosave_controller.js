import { Controller } from "@hotwired/stimulus"
import { Turbo } from "@hotwired/turbo-rails"

export default class extends Controller {
  static targets = ["field", "status"]
  static values = { url: String }

  connect() {
    this.timeout = null
  }

  disconnect() {
    clearTimeout(this.timeout)
  }

  schedule() {
    clearTimeout(this.timeout)
    this.setStatus("Sauvegarde...")
    this.timeout = setTimeout(() => this.save(), 1000)
  }

  async save() {
    try {
      const response = await fetch(this.urlValue, {
        method: "PATCH",
        headers: {
          "Accept": "text/vnd.turbo-stream.html",
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
        },
        body: JSON.stringify({
          journal_entry: { raw_text: this.fieldTarget.value }
        })
      })

      if (!response.ok) throw new Error(`Autosave failed: ${response.status}`)

      Turbo.renderStreamMessage(await response.text())
    } catch (_error) {
      this.setStatus("Sauvegarde impossible")
      this.statusTarget.classList.add("text-red-700")
    }
  }

  setStatus(text) {
    if (!this.hasStatusTarget) return

    this.statusTarget.textContent = text
    this.statusTarget.classList.remove("text-red-700")
  }
}
