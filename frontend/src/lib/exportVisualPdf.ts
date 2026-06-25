import { jsPDF } from "jspdf"
import * as htmlToImage from "html-to-image"

// A4 in points (72dpi): 210mm × 297mm.
const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89

/**
 * Capture the already-rendered A4 preview pages inside `container` and download them
 * as a visually-faithful PDF. Each `article[aria-label^="Resume page"]` becomes one
 * full A4 page in the output. Rendering goes through html-to-image (SVG foreignObject)
 * so Tailwind v4 `oklch()` colors are handled by the browser's own engine.
 */
export async function exportVisualPdf(
  container: HTMLElement,
  filename: string,
): Promise<void> {
  const pages = Array.from(
    container.querySelectorAll<HTMLElement>('article[aria-label^="Resume page"]'),
  )
  if (pages.length === 0) {
    throw new Error("No resume pages to export")
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })

  for (let i = 0; i < pages.length; i++) {
    const canvas = await htmlToImage.toCanvas(pages[i], {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    })
    if (i > 0) pdf.addPage()
    pdf.addImage(canvas, "PNG", 0, 0, A4_WIDTH_PT, A4_HEIGHT_PT)
  }

  const blob = pdf.output("blob")
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
