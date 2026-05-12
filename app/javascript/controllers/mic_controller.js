import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["button", "tooltip", "liveHint"]

  connect() {
    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    this.textarea = document.querySelector("[data-autosave-target='input']")
    this.listening = false
    this.restartTimer = null

    if (!this.SpeechRecognition) {
      this.buttonTarget.setAttribute("data-mic-state", "unsupported")
      this.buttonTarget.setAttribute("disabled", "")
      this.buttonTarget.setAttribute("aria-label", "Dictée non supportée")
      if (this.hasTooltipTarget) this.tooltipTarget.classList.remove("hidden")
    }
  }

  disconnect() {
    this.stop()
  }

  toggle() {
    if (!this.SpeechRecognition) return
    this.listening ? this.stop() : this.start()
  }

  start() {
    this.listening = true
    this.buildRecognition()
    this.setListening(true)
    this.safeStart()
  }

  stop() {
    this.listening = false
    clearTimeout(this.restartTimer)
    this.setListening(false)

    if (this.recognition) {
      try { this.recognition.stop() } catch (_error) {}
      this.recognition = null
    }
  }

  buildRecognition() {
    if (this.recognition) return

    const recognition = new this.SpeechRecognition()
    recognition.lang = "fr-FR"
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) this.append(result[0].transcript.trim())
      }
    }

    recognition.onerror = (event) => {
      console.warn("[mic]", event.error)
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        this.buttonTarget.setAttribute("data-mic-state", "unsupported")
        this.stop()
      }
    }

    recognition.onend = () => {
      if (!this.listening) return
      clearTimeout(this.restartTimer)
      this.restartTimer = setTimeout(() => this.safeStart(), 300)
    }

    this.recognition = recognition
  }

  safeStart() {
    if (!this.recognition || !this.listening) return

    try {
      this.recognition.start()
    } catch (_error) {
      clearTimeout(this.restartTimer)
      this.restartTimer = setTimeout(() => this.safeStart(), 300)
    }
  }

  setListening(on) {
    if (!this.hasButtonTarget) return

    this.buttonTarget.setAttribute("data-mic-state", on ? "listening" : "idle")
    this.buttonTarget.setAttribute("aria-label", on ? "Arrêter la dictée" : "Commencer la dictée")
    this.element.classList.toggle("is-listening", on)
  }

  append(text) {
    if (!text || !this.textarea) return

    const current = this.textarea.value
    const separator = current && !/[\s\n]$/.test(current) ? " " : ""
    this.textarea.value = `${current}${separator}${text}`
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }))
  }
}
