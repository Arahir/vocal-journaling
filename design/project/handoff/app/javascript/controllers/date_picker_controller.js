// app/javascript/controllers/date_picker_controller.js
//
// Popover calendrier minimal — un mois à la fois, navigation ‹ / ›.
// Les jours qui ont déjà une entrée (data-entry-dates) sont marqués d'un point.

import { Controller } from "@hotwired/stimulus";

const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DOW_INITIALS = ['L','M','M','J','V','S','D'];

export default class extends Controller {
  static targets = ["trigger", "popover", "monthLabel", "grid"];
  static values  = {
    selected: String,                       // ISO yyyy-mm-dd
    entries:  { type: Array, default: [] }, // ISO dates qui ont du contenu
    urlTemplate: { type: String, default: "/entries/__DATE__" }
  };

  connect() {
    const sel = this.selectedValue ? this._parseISO(this.selectedValue) : new Date();
    this.view = { y: sel.getFullYear(), m: sel.getMonth() };
    this._render();
  }

  toggle(e) {
    e?.stopPropagation();
    this.popoverTarget.classList.toggle("hidden");
  }

  clickOutside(e) {
    if (this.popoverTarget.classList.contains("hidden")) return;
    if (this.popoverTarget.contains(e.target) || this.triggerTarget.contains(e.target)) return;
    this.popoverTarget.classList.add("hidden");
  }

  prevMonth() {
    this.view = this.view.m === 0 ? { y: this.view.y - 1, m: 11 } : { ...this.view, m: this.view.m - 1 };
    this._render();
  }
  nextMonth() {
    this.view = this.view.m === 11 ? { y: this.view.y + 1, m: 0 } : { ...this.view, m: this.view.m + 1 };
    this._render();
  }

  // ── private ───────────────────────────────────────────────

  _render() {
    this.monthLabelTarget.textContent = `${MONTHS[this.view.m]} ${this.view.y}`;

    const today = this._stripTime(new Date());
    const todayISO = this._iso(today);
    const entrySet = new Set(this.entriesValue);

    const first = new Date(this.view.y, this.view.m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(this.view.y, this.view.m + 1, 0).getDate();
    const prevMonthDays = new Date(this.view.y, this.view.m, 0).getDate();

    const grid = this.gridTarget;
    grid.innerHTML = "";

    // Headers
    for (const d of DOW_INITIALS) {
      const span = document.createElement("span");
      span.className = "picker-dow";
      span.textContent = d;
      grid.appendChild(span);
    }

    const pushCell = (day, monthOffset, dim) => {
      const date = new Date(this.view.y, this.view.m + monthOffset, day);
      const iso = this._iso(date);
      const future = date > today;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "picker-day"
                    + (dim ? " is-dim" : "")
                    + (iso === todayISO ? " is-today" : "")
                    + (iso === this.selectedValue ? " is-selected" : "")
                    + (entrySet.has(iso) ? " has-entry" : "");
      btn.textContent = day;
      if (future) {
        btn.disabled = true;
      } else {
        btn.addEventListener("click", () => {
          window.location.href = this.urlTemplateValue.replace("__DATE__", iso);
        });
      }
      grid.appendChild(btn);
    };

    for (let i = 0; i < startOffset; i++) {
      pushCell(prevMonthDays - startOffset + 1 + i, -1, true);
    }
    for (let d = 1; d <= daysInMonth; d++) pushCell(d, 0, false);
    let i = 1;
    while (grid.children.length - 7 < 42) {
      pushCell(i++, 1, true);
    }
  }

  _iso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  _parseISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  _stripTime(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
}
