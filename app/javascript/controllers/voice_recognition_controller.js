import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["textarea", "button", "indicator"]

  connect() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    this.listening = false
    this.restartTimer = null

    if (!SpeechRecognition) {
      this.buttonTarget.disabled = true
      this.buttonTarget.textContent = "Dictée indisponible"
      this.buttonTarget.title = "Dictée non supportée par ce navigateur"
      this.buttonTarget.classList.add("opacity-50", "cursor-not-allowed")
      return
    }

    this.recognition = new SpeechRecognition()
    this.recognition.lang = "fr-FR"
    this.recognition.continuous = true
    this.recognition.interimResults = false
    this.recognition.onresult = (event) => this.handleResult(event)
    this.recognition.onend = () => this.restartIfNeeded()
    this.recognition.onerror = () => this.stop()
  }

  disconnect() {
    clearTimeout(this.restartTimer)
    if (this.recognition && this.listening) this.recognition.stop()
  }

  toggle() {
    if (this.listening) {
      this.stop()
    } else {
      this.start()
    }
  }

  start() {
    if (!this.recognition) return

    this.listening = true
    this.updateUi()
    this.safeStart()
  }

  stop() {
    this.listening = false
    clearTimeout(this.restartTimer)
    this.updateUi()
    if (this.recognition) this.recognition.stop()
  }

  safeStart() {
    try {
      this.recognition.start()
    } catch (_error) {
      clearTimeout(this.restartTimer)
      this.restartTimer = setTimeout(() => {
        if (this.listening) this.safeStart()
      }, 300)
    }
  }

  restartIfNeeded() {
    if (!this.listening) return

    clearTimeout(this.restartTimer)
    this.restartTimer = setTimeout(() => this.safeStart(), 300)
  }

  handleResult(event) {
    const transcript = Array.from(event.results)
      .slice(event.resultIndex)
      .filter((result) => result.isFinal)
      .map((result) => result[0].transcript)
      .join(" ")
      .trim()

    if (!transcript) return

    const textarea = this.textareaTarget
    const separator = textarea.value && !textarea.value.endsWith(" ") ? " " : ""
    textarea.value = `${textarea.value}${separator}${transcript}`
    textarea.dispatchEvent(new Event("input", { bubbles: true }))
  }

  updateUi() {
    this.buttonTarget.textContent = this.listening ? "Arrêter" : "Dicter"
    this.indicatorTarget.classList.toggle("bg-red-600", this.listening)
    this.indicatorTarget.classList.toggle("bg-stone-300", !this.listening)
    this.indicatorTarget.classList.toggle("animate-pulse", this.listening)
  }
}
