import { Controller } from "@hotwired/stimulus"

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
const DOW_INITIALS = ["L", "M", "M", "J", "V", "S", "D"]

export default class extends Controller {
  static targets = ["trigger", "popover", "monthLabel", "grid"]
  static values = {
    selected: String,
    entries: { type: Array, default: [] },
    urlTemplate: { type: String, default: "/entries/__DATE__" }
  }

  connect() {
    const selected = this.selectedValue ? this.parseIso(this.selectedValue) : new Date()
    this.view = { year: selected.getFullYear(), month: selected.getMonth() }
    this.render()
  }

  toggle(event) {
    event?.stopPropagation()
    this.popoverTarget.classList.toggle("hidden")
  }

  clickOutside(event) {
    if (this.popoverTarget.classList.contains("hidden")) return
    if (this.popoverTarget.contains(event.target) || this.triggerTarget.contains(event.target)) return

    this.popoverTarget.classList.add("hidden")
  }

  prevMonth() {
    this.view = this.view.month === 0 ? { year: this.view.year - 1, month: 11 } : { ...this.view, month: this.view.month - 1 }
    this.render()
  }

  nextMonth() {
    this.view = this.view.month === 11 ? { year: this.view.year + 1, month: 0 } : { ...this.view, month: this.view.month + 1 }
    this.render()
  }

  render() {
    this.monthLabelTarget.textContent = `${MONTHS[this.view.month]} ${this.view.year}`

    const today = this.stripTime(new Date())
    const todayIso = this.iso(today)
    const entrySet = new Set(this.entriesValue)
    const first = new Date(this.view.year, this.view.month, 1)
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(this.view.year, this.view.month + 1, 0).getDate()
    const prevMonthDays = new Date(this.view.year, this.view.month, 0).getDate()

    this.gridTarget.innerHTML = ""

    DOW_INITIALS.forEach((day) => {
      const element = document.createElement("span")
      element.className = "picker-dow"
      element.textContent = day
      this.gridTarget.appendChild(element)
    })

    for (let index = 0; index < startOffset; index += 1) {
      this.pushCell(prevMonthDays - startOffset + 1 + index, -1, true, today, todayIso, entrySet)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      this.pushCell(day, 0, false, today, todayIso, entrySet)
    }

    let nextDay = 1
    while (this.gridTarget.children.length - 7 < 42) {
      this.pushCell(nextDay, 1, true, today, todayIso, entrySet)
      nextDay += 1
    }
  }

  pushCell(day, monthOffset, dim, today, todayIso, entrySet) {
    const date = new Date(this.view.year, this.view.month + monthOffset, day)
    const iso = this.iso(date)
    const button = document.createElement("button")

    button.type = "button"
    button.className = "picker-day" +
      (dim ? " is-dim" : "") +
      (iso === todayIso ? " is-today" : "") +
      (iso === this.selectedValue ? " is-selected" : "") +
      (entrySet.has(iso) ? " has-entry" : "")
    button.textContent = day

    if (date > today) {
      button.disabled = true
    } else {
      button.addEventListener("click", () => {
        window.location.href = this.urlTemplateValue.replace("__DATE__", iso)
      })
    }

    this.gridTarget.appendChild(button)
  }

  iso(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  parseIso(value) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
  }

  stripTime(date) {
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)
    return copy
  }
}
