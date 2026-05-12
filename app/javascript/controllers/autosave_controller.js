import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "hint", "meta", "form"]
  static values = {
    url: String,
    delay: { type: Number, default: 800 },
    hintDelay: { type: Number, default: 5000 }
  }

  connect() {
    this.timer = null
    this.hintTimer = null
    this.lastSaved = this.inputTarget.value
    this.renderMeta()
  }

  disconnect() {
    clearTimeout(this.timer)
    clearTimeout(this.hintTimer)
  }

  change() {
    this.renderMeta()
    if (this.inputTarget.value === this.lastSaved) return

    clearTimeout(this.timer)
    clearTimeout(this.hintTimer)
    this.hideHint()

    this.timer = setTimeout(() => this.save(), this.delayValue)
    this.hintTimer = setTimeout(() => this.showHint(), this.hintDelayValue)
  }

  async save() {
    const token = document.querySelector("meta[name='csrf-token']")?.content
    const formData = new FormData(this.formTarget)

    try {
      const response = await fetch(this.urlValue, {
        method: "PATCH",
        headers: {
          "Accept": "text/vnd.turbo-stream.html, application/json",
          "X-CSRF-Token": token || ""
        },
        body: formData
      })

      if (!response.ok) throw new Error(`Save failed: ${response.status}`)
      this.lastSaved = this.inputTarget.value
    } catch (error) {
      console.warn("[autosave]", error)
    }
  }

  showHint() {
    if (!this.hasHintTarget) return

    this.hintTarget.style.opacity = "1"
    setTimeout(() => this.hideHint(), 1800)
  }

  hideHint() {
    if (this.hasHintTarget) this.hintTarget.style.opacity = "0"
  }

  renderMeta() {
    if (!this.hasMetaTarget) return

    const words = (this.inputTarget.value.match(/\S+/g) || []).length
    this.metaTarget.textContent = words === 0 ? "" : `${words} mots`
  }
}
