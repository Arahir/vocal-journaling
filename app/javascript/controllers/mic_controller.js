import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["button", "tooltip", "liveHint", "liveLabel"]

  connect() {
    this.textarea = document.querySelector("[data-autosave-target='input']")
    this.stream = null
    this.audioContext = null
    this.source = null
    this.processor = null
    this.chunks = []
    this.recording = false
    this.transcribing = false

    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext && !window.webkitAudioContext) {
      this.unsupported()
    }
  }

  disconnect() {
    this.cleanupAudio()
  }

  toggle() {
    if (this.transcribing) return
    this.recording ? this.stop() : this.start()
  }

  async start() {
    if (this.recording || this.transcribing) return

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContextClass()
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.chunks = []

      this.processor.onaudioprocess = (event) => {
        if (!this.recording) return

        this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      this.recording = true
      this.setState("listening")
    } catch (error) {
      console.warn("[mic]", error)
      this.unsupported()
    }
  }

  stop() {
    if (!this.recording) return

    this.recording = false
    const sampleRate = this.audioContext.sampleRate
    const chunks = this.chunks
    this.cleanupAudio()
    this.transcribe(this.wavBlob(chunks, sampleRate))
  }

  async transcribe(blob) {
    if (blob.size === 0) {
      this.setState("idle")
      return
    }

    this.transcribing = true
    this.setState("transcribing")

    try {
      const result = await this.upload(blob)
      this.append(result.text)
    } catch (error) {
      console.warn("[mic]", error)
      this.showTemporaryError(error.message)
    } finally {
      this.transcribing = false
      this.setState("idle")
    }
  }

  async upload(blob) {
    const formData = new FormData()
    formData.append("audio", blob, "dictation.wav")

    const response = await fetch("/transcription", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "X-CSRF-Token": document.querySelector("meta[name='csrf-token']")?.content || ""
      },
      body: formData
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Transcription failed: ${response.status}`)

    return payload
  }

  append(text) {
    if (!text || !this.textarea) return

    const current = this.textarea.value
    const separator = current && !/[\s\n]$/.test(current) ? " " : ""
    this.textarea.value = `${current}${separator}${text.trim()}`
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }))
  }

  wavBlob(chunks, sampleRate) {
    const samples = this.downsample(this.flatten(chunks), sampleRate, 16000)
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    this.writeString(view, 0, "RIFF")
    view.setUint32(4, 36 + samples.length * 2, true)
    this.writeString(view, 8, "WAVE")
    this.writeString(view, 12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, 16000, true)
    view.setUint32(28, 16000 * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    this.writeString(view, 36, "data")
    view.setUint32(40, samples.length * 2, true)

    let offset = 44
    samples.forEach((sample) => {
      const clamped = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
      offset += 2
    })

    return new Blob([buffer], { type: "audio/wav" })
  }

  flatten(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Float32Array(length)
    let offset = 0

    chunks.forEach((chunk) => {
      result.set(chunk, offset)
      offset += chunk.length
    })

    return result
  }

  downsample(samples, inputRate, outputRate) {
    if (inputRate === outputRate) return samples
    if (inputRate < outputRate) return samples

    const ratio = inputRate / outputRate
    const length = Math.round(samples.length / ratio)
    const result = new Float32Array(length)

    for (let index = 0; index < length; index += 1) {
      const start = Math.floor(index * ratio)
      const end = Math.floor((index + 1) * ratio)
      let sum = 0
      let count = 0

      for (let sampleIndex = start; sampleIndex < end && sampleIndex < samples.length; sampleIndex += 1) {
        sum += samples[sampleIndex]
        count += 1
      }

      result[index] = count > 0 ? sum / count : 0
    }

    return result
  }

  writeString(view, offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  setState(state) {
    if (!this.hasButtonTarget) return

    this.buttonTarget.setAttribute("data-mic-state", state)
    this.buttonTarget.disabled = state === "transcribing"
    this.element.classList.toggle("is-listening", state === "listening")
    this.element.classList.toggle("is-transcribing", state === "transcribing")

    if (this.hasLiveLabelTarget) {
      this.liveLabelTarget.textContent = state === "transcribing" ? "Transcription..." : "Écoute..."
    }

    const labels = {
      idle: "Commencer la dictée",
      listening: "Arrêter la dictée",
      transcribing: "Transcription en cours",
      unsupported: "Enregistrement non supporté"
    }
    this.buttonTarget.setAttribute("aria-label", labels[state] || labels.idle)
  }

  unsupported() {
    this.setState("unsupported")
    this.buttonTarget.setAttribute("disabled", "")
    if (this.hasTooltipTarget) this.tooltipTarget.classList.remove("hidden")
  }

  showTemporaryError(message) {
    if (!this.hasTooltipTarget) return

    this.tooltipTarget.textContent = message || "Transcription impossible. Vérifie ta clé OpenRouter."
    this.tooltipTarget.classList.remove("hidden")
    setTimeout(() => this.tooltipTarget.classList.add("hidden"), 3000)
  }

  cleanupAudio() {
    if (this.processor) {
      this.processor.disconnect()
      this.processor.onaudioprocess = null
      this.processor = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}
