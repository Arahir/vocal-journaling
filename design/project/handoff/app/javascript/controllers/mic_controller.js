// app/javascript/controllers/mic_controller.js
//
// Bouton micro — Web Speech API.
//
// • Tap = toggle (commence/arrête). Pas de press-and-hold.
// • interimResults = false : on n'écrit dans le textarea que les segments
//   finaux pour éviter le texte qui sautille.
// • Sur un navigateur sans support (Firefox actuel), data-mic-state="unsupported"
//   est posé dès la connexion — le CSS gère le grisé + révèle le tooltip.

import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["button", "tooltip", "liveHint"];

  connect() {
    this.SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!this.SR) {
      this.buttonTarget.setAttribute("data-mic-state", "unsupported");
      this.buttonTarget.setAttribute("disabled", "");
      this.buttonTarget.setAttribute("aria-label", "Dictée non supportée");
      if (this.hasTooltipTarget) this.tooltipTarget.classList.remove("hidden");
      return;
    }
    this.recognition = null;
    this.textarea = document.querySelector('[data-autosave-target="input"]');
  }

  disconnect() { this.stop(); }

  toggle() {
    if (!this.SR) return;
    this.isListening ? this.stop() : this.start();
  }

  start() {
    if (!this.SR || this.recognition) return;

    const rec = new this.SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false; // résultats finaux uniquement

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this._append(r[0].transcript.trim());
      }
    };

    rec.onerror = (e) => {
      console.warn("[mic] error:", e.error);
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error)) {
        this.buttonTarget.setAttribute("data-mic-state", "unsupported");
      }
      this.stop();
    };

    rec.onend = () => {
      if (this.recognition === rec) this._setListening(false);
    };

    this.recognition = rec;
    this._setListening(true);
    rec.start();
  }

  stop() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
      this.recognition = null;
    }
    this._setListening(false);
  }

  // ── private ─────────────────────────────────────────────────

  _setListening(on) {
    this.isListening = on;
    this.buttonTarget.setAttribute("data-mic-state", on ? "listening" : "idle");
    this.buttonTarget.setAttribute("aria-label", on ? "Arrêter la dictée" : "Commencer la dictée");
    this.element.classList.toggle("is-listening", on);
  }

  _append(text) {
    if (!text || !this.textarea) return;
    const cur = this.textarea.value;
    const sep = cur && !/[\s\n]$/.test(cur) ? " " : "";
    this.textarea.value = cur + sep + text;
    // Re-déclenche l'autosave
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
