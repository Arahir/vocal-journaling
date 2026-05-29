import { Controller } from "@hotwired/stimulus"

// A simple Pomodoro timer: pick a mode (focus / short break / long break),
// then start, pause and reset. Counts completed focus sessions.
export default class extends Controller {
  static targets = ["display", "label", "progress", "toggle", "modeButton", "rounds"]
  static values = {
    focus: Number,
    short: Number,
    long: Number
  }

  connect() {
    this.labels = {
      focus: "Concentration",
      short: "Pause courte",
      long: "Pause longue"
    }
    this.rounds = 0
    this.interval = null
    this.running = false
    this.mode = "focus"
    this.remaining = this.durationFor(this.mode)
    this.render()
  }

  disconnect() {
    this.stopTicking()
  }

  durationFor(mode) {
    const minutes = { focus: this.focusValue, short: this.shortValue, long: this.longValue }[mode]
    return minutes * 60
  }

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode
    if (mode === this.mode && this.running) return

    this.pause()
    this.mode = mode
    this.remaining = this.durationFor(mode)
    this.render()
  }

  toggle() {
    this.running ? this.pause() : this.start()
  }

  start() {
    if (this.running) return
    this.running = true
    this.endAt = this.now() + this.remaining * 1000
    this.interval = setInterval(() => this.tick(), 250)
    this.render()
  }

  pause() {
    if (!this.running) return
    this.running = false
    this.remaining = Math.max(0, Math.round((this.endAt - this.now()) / 1000))
    this.stopTicking()
    this.render()
  }

  reset() {
    this.pause()
    this.remaining = this.durationFor(this.mode)
    this.render()
  }

  tick() {
    this.remaining = Math.max(0, Math.round((this.endAt - this.now()) / 1000))
    if (this.remaining <= 0) {
      this.complete()
      return
    }
    this.render()
  }

  complete() {
    this.stopTicking()
    this.running = false
    this.remaining = 0
    if (this.mode === "focus") {
      this.rounds += 1
    }
    this.notify()
    this.render()
  }

  notify() {
    // A gentle chime; falls back silently if audio is unavailable.
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.value = 660
      gain.gain.setValueAtTime(0.001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
      osc.start()
      osc.stop(ctx.currentTime + 0.8)
    } catch (_error) {
      // ignore
    }
  }

  stopTicking() {
    clearInterval(this.interval)
    this.interval = null
  }

  now() {
    return performance.now()
  }

  render() {
    const total = this.durationFor(this.mode)
    const mins = Math.floor(this.remaining / 60)
    const secs = this.remaining % 60
    this.displayTarget.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`

    if (this.hasLabelTarget) this.labelTarget.textContent = this.labels[this.mode]
    if (this.hasRoundsTarget) this.roundsTarget.textContent = this.rounds
    if (this.hasToggleTarget) this.toggleTarget.textContent = this.running ? "Pause" : "Démarrer"

    if (this.hasProgressTarget) {
      const elapsed = total - this.remaining
      this.progressTarget.style.strokeDashoffset = ((elapsed / total) * 100).toFixed(2)
    }

    document.title = this.running
      ? `${this.displayTarget.textContent} — ${this.labels[this.mode]}`
      : "Minuteur"

    this.modeButtonTargets.forEach((button) => {
      const active = button.dataset.mode === this.mode
      button.classList.toggle("border-accent", active)
      button.classList.toggle("bg-accent-soft", active)
      button.classList.toggle("text-ink", active)
      button.classList.toggle("border-rule", !active)
      button.classList.toggle("text-ink-mute", !active)
    })
  }
}
