// app/javascript/controllers/autosave_controller.js
//
// Autosave silencieuse du textarea.
//
// • Debounce 800 ms (configurable via data-autosave-delay-value).
// • L'indicateur "Sauvegardé" n'apparaît qu'après 5 s sans frappe
//   (data-autosave-hint-delay-value), comme demandé dans le brief.
// • PATCH /entries/:date en form-encoded — le controller Rails répond 204
//   ou un Turbo Stream selon le besoin.

import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["input", "hint", "meta", "form"];
  static values  = { url: String, delay: { type: Number, default: 800 }, hintDelay: { type: Number, default: 5000 } };

  connect() {
    this._timer = null;
    this._hintTimer = null;
    this._lastSaved = this.inputTarget.value;
    this._renderMeta();
  }

  disconnect() {
    clearTimeout(this._timer);
    clearTimeout(this._hintTimer);
  }

  change() {
    this._renderMeta();
    if (this.inputTarget.value === this._lastSaved) return;

    clearTimeout(this._timer);
    clearTimeout(this._hintTimer);
    this._hideHint();

    this._timer = setTimeout(() => this._save(), this.delayValue);
    this._hintTimer = setTimeout(() => this._showHint(), this.hintDelayValue);
  }

  async _save() {
    const value = this.inputTarget.value;
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    try {
      const form = new FormData();
      form.append("entry[raw_text]", value);
      const res = await fetch(this.urlValue, {
        method: "PATCH",
        headers: {
          "Accept": "text/vnd.turbo-stream.html, application/json",
          "X-CSRF-Token": token || ""
        },
        body: form
      });
      if (!res.ok) throw new Error("Save failed: " + res.status);
      this._lastSaved = value;
    } catch (err) {
      console.warn("[autosave]", err);
    }
  }

  _showHint() {
    if (!this.hasHintTarget) return;
    this.hintTarget.style.opacity = "1";
    setTimeout(() => this._hideHint(), 1800);
  }
  _hideHint() {
    if (this.hasHintTarget) this.hintTarget.style.opacity = "0";
  }

  _renderMeta() {
    if (!this.hasMetaTarget) return;
    const words = (this.inputTarget.value.match(/\S+/g) || []).length;
    this.metaTarget.textContent = words === 0 ? "" : `${words} mots`;
  }
}
