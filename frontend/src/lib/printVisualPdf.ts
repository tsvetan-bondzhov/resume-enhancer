// Print stylesheet applied inside the isolated print iframe. Forces every resume
// page to fill exactly one A4 sheet with no margins/shadows so the browser's
// "Save as PDF" output matches the on-screen preview while keeping real,
// selectable text and working <a> links (vector, not a rasterised image).
const PRINT_CSS = `
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #ffffff; }
article[aria-label^="Resume page"] {
  box-shadow: none !important;
  margin: 0 !important;
  width: 210mm !important;
  height: 297mm !important;
  max-width: none !important;
  overflow: hidden;
  break-after: page;
  page-break-after: always;
  break-inside: avoid;
}
article[aria-label^="Resume page"]:last-child {
  break-after: auto;
  page-break-after: auto;
}
`

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/**
 * Builds the standalone HTML document (with DOCTYPE for standards-mode layout)
 * loaded into the print iframe: the host stylesheets, the A4 print rules, and the
 * cloned resume pages. Pure/exported so it can be unit-tested without a real frame.
 */
export function composePrintMarkup(
  pagesHtml: string,
  headStyles: string,
  title: string,
): string {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `${headStyles}<style>${PRINT_CSS}</style></head><body>${pagesHtml}</body></html>`
  )
}

// Resolves once the iframe document has parsed the injected resume pages. Listens
// for `load` but also polls, so it works across browsers and the jsdom test env.
function waitForFrameReady(iframe: HTMLIFrameElement): Promise<void> {
  const hasPages = () =>
    iframe.contentDocument?.querySelector('article[aria-label^="Resume page"]') != null
  if (hasPages()) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    // `load` is the reliable browser signal (it waits for the cloned stylesheets
    // and fonts). The poll is only a fallback for environments where it never
    // fires (e.g. jsdom doesn't load srcdoc), so keep its cap short.
    iframe.addEventListener("load", done, { once: true })
    const start = Date.now()
    const poll = () => {
      if (settled) return
      if (hasPages() || Date.now() - start > 800) {
        done()
        return
      }
      setTimeout(poll, 16)
    }
    poll()
  })
}

// Waits for the iframe's copied stylesheets and web fonts to be ready, so the
// printed pages use the template fonts/colors rather than fallbacks.
async function waitForAssets(doc: Document): Promise<void> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
  await Promise.all(
    links.map((link) => {
      if (link.sheet) return Promise.resolve()
      return new Promise<void>((resolve) => {
        link.addEventListener("load", () => resolve(), { once: true })
        link.addEventListener("error", () => resolve(), { once: true })
      })
    }),
  )
  const fonts = doc.fonts
  if (fonts) {
    try {
      await fonts.ready
    } catch {
      // Font readiness is best-effort — never block printing on it.
    }
  }
}

/**
 * Print the already-rendered A4 preview pages inside `container` through the
 * browser's own print engine ("Save as PDF"). Because it reuses the live DOM
 * (cloned into an isolated iframe with the app's stylesheets), the output keeps
 * full visual fidelity AND real selectable text and clickable links — unlike a
 * rasterised capture.
 *
 * `filename` is used as the document title, which most browsers pre-fill as the
 * suggested PDF file name in the print dialog.
 */
export async function printVisualPdf(container: HTMLElement, filename: string): Promise<void> {
  const pages = Array.from(
    container.querySelectorAll<HTMLElement>('article[aria-label^="Resume page"]'),
  )
  if (pages.length === 0) {
    throw new Error("No resume pages to export")
  }

  // Copy the host document's stylesheets + font definitions so the cloned pages
  // render identically; inline CSS variables travel with the cloned articles.
  const headStyles = Array.from(
    document.head.querySelectorAll('style, link[rel="stylesheet"]'),
  )
    .map((node) => node.outerHTML)
    .join("\n")
  const pagesHtml = pages.map((page) => page.outerHTML).join("\n")

  const html = composePrintMarkup(pagesHtml, headStyles, filename)

  // Isolated iframe so the app chrome is excluded and the host page is untouched.
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
  iframe.srcdoc = html
  document.body.appendChild(iframe)

  await waitForFrameReady(iframe)

  const iframeDoc = iframe.contentDocument
  const frameWindow = iframe.contentWindow
  if (!iframeDoc || !frameWindow) {
    iframe.remove()
    throw new Error("Could not open the print view")
  }

  await waitForAssets(iframeDoc)

  const cleanup = () => {
    if (iframe.parentNode) iframe.remove()
  }
  // Remove the iframe once the print dialog closes; keep a long safety timeout in
  // case `afterprint` never fires (e.g. some headless contexts).
  frameWindow.addEventListener("afterprint", cleanup, { once: true })
  setTimeout(cleanup, 5 * 60 * 1000)

  frameWindow.focus()
  frameWindow.print()
}
