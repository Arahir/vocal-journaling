import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["editor", "input"]

  connect() {
    this.editorTarget.innerHTML = this.markdownToHtml(this.inputTarget.value)
    this.sync()
  }

  format(event) {
    event.preventDefault()

    const command = event.params.command
    this.editorTarget.focus()

    if (command === "h1" || command === "h2" || command === "p") {
      document.execCommand("formatBlock", false, command)
    } else if (command === "ul") {
      document.execCommand("insertUnorderedList")
    } else {
      document.execCommand(command)
    }

    this.sync()
  }

  keepSelection(event) {
    event.preventDefault()
  }

  paste(event) {
    event.preventDefault()
    const text = event.clipboardData.getData("text/plain")
    document.execCommand("insertText", false, text)
    this.syncSoon()
  }

  sync() {
    this.inputTarget.value = this.htmlToMarkdown()
  }

  syncSoon() {
    requestAnimationFrame(() => this.sync())
  }

  markdownToHtml(markdown) {
    const container = document.createElement("div")
    let list = null

    markdown.split(/\r?\n/).forEach((line) => {
      if (line.startsWith("- ")) {
        list ||= container.appendChild(document.createElement("ul"))
        const item = document.createElement("li")
        item.append(...this.inlineNodes(line.slice(2)))
        list.appendChild(item)
        return
      }

      list = null

      if (line.startsWith("## ")) {
        this.appendBlock(container, "h2", line.slice(3))
      } else if (line.startsWith("# ")) {
        this.appendBlock(container, "h1", line.slice(2))
      } else if (line.trim() !== "") {
        this.appendBlock(container, "p", line)
      }
    })

    if (!container.hasChildNodes()) {
      container.appendChild(document.createElement("p"))
    }

    return container.innerHTML
  }

  appendBlock(container, tagName, text) {
    const block = document.createElement(tagName)
    block.append(...this.inlineNodes(text))
    container.appendChild(block)
  }

  inlineNodes(text) {
    const nodes = []
    const parts = text.split("**")

    parts.forEach((part, index) => {
      if (part === "") return

      if (index % 2 === 1) {
        const strong = document.createElement("strong")
        strong.textContent = part
        nodes.push(strong)
      } else {
        nodes.push(document.createTextNode(part))
      }
    })

    return nodes
  }

  htmlToMarkdown() {
    const lines = []

    this.editorTarget.childNodes.forEach((node) => {
      this.appendMarkdownForNode(lines, node)
    })

    return `${lines.join("\n\n").trim()}\n`
  }

  appendMarkdownForNode(lines, node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = this.cleanBlockText(node.textContent)
      if (text) lines.push(text)
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return

    const tagName = node.tagName.toLowerCase()

    if (tagName === "h1") {
      lines.push(`# ${this.inlineMarkdown(node)}`)
    } else if (tagName === "h2") {
      lines.push(`## ${this.inlineMarkdown(node)}`)
    } else if (tagName === "ul") {
      const items = Array.from(node.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child) => `- ${this.inlineMarkdown(child)}`)
      if (items.length > 0) lines.push(items.join("\n"))
    } else if (tagName === "ol") {
      const items = Array.from(node.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child, index) => `${index + 1}. ${this.inlineMarkdown(child)}`)
      if (items.length > 0) lines.push(items.join("\n"))
    } else {
      const text = this.inlineMarkdown(node)
      if (text) lines.push(text)
    }
  }

  inlineMarkdown(node) {
    return Array.from(node.childNodes)
      .map((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          return child.textContent
        }

        if (child.nodeType !== Node.ELEMENT_NODE) {
          return ""
        }

        const tagName = child.tagName.toLowerCase()

        if (tagName === "br") {
          return "\n"
        }

        const text = this.inlineMarkdown(child)

        if (tagName === "strong" || tagName === "b") {
          return text ? `**${text}**` : ""
        }

        return text
      })
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  cleanBlockText(text) {
    return text.replace(/\s+/g, " ").trim()
  }
}
