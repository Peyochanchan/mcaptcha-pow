import { Controller } from "@hotwired/stimulus"
import { solve } from "mcaptcha-pow"

// Placed on the form. Solves the challenge when the visitor ticks the box, and
// holds the submission until a token is in. The markup and its labels are
// rendered by the server (see examples/rails/_mcaptcha.html.erb), so nothing
// here builds HTML.
export default class extends Controller {
  static targets = ["check", "token", "status"]
  static values = {
    instanceUrl: String,
    sitekey: String,
    workerUrl: String,
    solving: String,
    solved: String,
    failed: String,
    required: String
  }

  disconnect() {
    this.pending?.abort()
  }

  async solve() {
    if (!this.checkTarget.checked) return

    this.checkTarget.disabled = true
    this.announce(this.solvingValue, "solving")
    this.pending = new AbortController()

    try {
      this.tokenTarget.value = await solve({
        instanceUrl: this.instanceUrlValue,
        sitekey: this.sitekeyValue,
        workerUrl: this.workerUrlValue || undefined,
        signal: this.pending.signal
      })
      this.announce(this.solvedValue, "solved")
    } catch (error) {
      if (error.name === "AbortError") return
      this.checkTarget.checked = false
      this.checkTarget.disabled = false
      this.announce(this.failedValue, "failed")
    }
  }

  // submit->mcaptcha#guard
  guard(event) {
    if (this.tokenTarget.value) return
    event.preventDefault()
    this.announce(this.requiredValue, "required")
  }

  // The status element is a live region: screen readers read each change.
  announce(message, state) {
    this.statusTarget.textContent = message
    this.element.dataset.mcaptchaState = state
  }
}
