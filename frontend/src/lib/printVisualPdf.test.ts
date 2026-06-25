import { describe, it, expect, beforeEach } from "vitest"
import { printVisualPdf, composePrintMarkup } from "./printVisualPdf"

// Builds a container holding `count` fake A4 page <article>s like ResumeCanvas renders.
function buildContainer(count: number): HTMLElement {
  const container = document.createElement("div")
  for (let i = 1; i <= count; i++) {
    const article = document.createElement("article")
    article.setAttribute("aria-label", `Resume page ${i}`)
    article.innerHTML = `<a href="https://example.com/${i}">link ${i}</a>`
    container.appendChild(article)
  }
  return container
}

describe("composePrintMarkup", () => {
  it("embeds the pages, title, host styles and A4 print rules", () => {
    const html = composePrintMarkup(
      '<article aria-label="Resume page 1">hi</article>',
      "<style>.themed{color:red}</style>",
      "My Resume",
    )
    expect(html).toContain("<!DOCTYPE html>") // standards-mode layout
    expect(html).toContain("<title>My Resume</title>")
    expect(html).toContain('<article aria-label="Resume page 1">hi</article>')
    expect(html).toContain(".themed{color:red}")
    expect(html).toContain("@page")
  })

  it("escapes the title to avoid breaking the markup", () => {
    const html = composePrintMarkup("", "", 'A "B" <C>')
    expect(html).toContain("<title>A &quot;B&quot; &lt;C&gt;</title>")
  })
})

describe("printVisualPdf", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    document.head.innerHTML = ""
  })

  it("mounts an isolated iframe whose srcdoc carries the cloned pages and title", async () => {
    const style = document.createElement("style")
    style.textContent = ".themed { color: rgb(1, 2, 3); }"
    document.head.appendChild(style)

    await printVisualPdf(buildContainer(2), "My Resume")

    const iframe = document.querySelector("iframe")
    expect(iframe).not.toBeNull()
    const srcdoc = iframe!.getAttribute("srcdoc") ?? ""
    expect(srcdoc).toContain("<title>My Resume</title>")
    // Both pages cloned, links preserved as real anchors (selectable/clickable text).
    expect(srcdoc).toContain('aria-label="Resume page 1"')
    expect(srcdoc).toContain('aria-label="Resume page 2"')
    expect(srcdoc).toContain('href="https://example.com/1"')
    // Host stylesheet copied so template styling is preserved.
    expect(srcdoc).toContain(".themed { color: rgb(1, 2, 3); }")
  })

  it("removes the iframe after the print dialog closes", async () => {
    await printVisualPdf(buildContainer(1), "Cleanup")
    const iframe = document.querySelector("iframe")!
    iframe.contentWindow!.dispatchEvent(new Event("afterprint"))
    expect(document.querySelector("iframe")).toBeNull()
  })

  it("throws when there are no pages to print", async () => {
    await expect(printVisualPdf(buildContainer(0), "Empty")).rejects.toThrow(/no resume pages/i)
  })
})
