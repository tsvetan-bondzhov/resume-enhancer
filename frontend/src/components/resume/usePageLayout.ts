import { useState, useCallback, useRef } from "react"
import type { ResumeSectionDto } from "@/types/api"
import { PAGE_HEIGHT_PX } from "./resumeConstants"

export interface PageSectionSlice {
  sectionType: string
  showTitle: boolean
  visibleItemIds: ReadonlySet<string>
}

export type PageLayout = PageSectionSlice[][]

interface UsePageLayoutResult {
  pageLayout: PageLayout | null
  pageCount: number
  measureRef: React.RefCallback<HTMLDivElement>
}

interface FlowUnit {
  sectionType: string
  itemId: string | null
  top: number
  bottom: number
}

interface SliceAccumulator {
  sectionType: string
  showTitle: boolean
  itemIds: Set<string>
}

// Builds an ordered list of measurable units (one per section title, one per item),
// each with its real rendered top/bottom relative to the first block. Using actual
// positions — rather than summed deltas — keeps fit and orphan decisions accurate and
// robust to render order, and avoids counting trailing margins toward fit checks.
function buildFlowUnits(container: HTMLElement, sections: ResumeSectionDto[]): FlowUnit[] {
  const measured: { sectionType: string; itemId: string | null; top: number; bottom: number }[] = []

  for (const section of sections) {
    const sectionEl = container.querySelector<HTMLElement>(
      `[data-section-type="${section.sectionType}"]`,
    )
    if (!sectionEl) continue

    const titleEl = sectionEl.querySelector("h2")
    if (titleEl) {
      const rect = titleEl.getBoundingClientRect()
      measured.push({ sectionType: section.sectionType, itemId: null, top: rect.top, bottom: rect.bottom })
    }

    for (const item of section.items) {
      const el = sectionEl.querySelector<HTMLElement>(`[data-item-id="${item.id}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        measured.push({ sectionType: section.sectionType, itemId: item.id, top: rect.top, bottom: rect.bottom })
      }
    }
  }

  if (measured.length === 0) return []

  const origin = Math.min(...measured.map((m) => m.top))
  return measured
    .map((m) => ({
      sectionType: m.sectionType,
      itemId: m.itemId,
      top: m.top - origin,
      bottom: m.bottom - origin,
    }))
    .sort((a, b) => a.top - b.top)
}

function commitAccumulators(
  layout: PageLayout,
  accumulators: Map<string, SliceAccumulator>,
): void {
  if (accumulators.size === 0) return
  const slices: PageSectionSlice[] = []
  for (const acc of accumulators.values()) {
    slices.push({
      sectionType: acc.sectionType,
      showTitle: acc.showTitle,
      visibleItemIds: acc.itemIds,
    })
  }
  layout.push(slices)
}

function placeUnit(accumulators: Map<string, SliceAccumulator>, unit: FlowUnit): void {
  let acc = accumulators.get(unit.sectionType)
  if (!acc) {
    acc = { sectionType: unit.sectionType, showTitle: false, itemIds: new Set() }
    accumulators.set(unit.sectionType, acc)
  }
  if (unit.itemId === null) {
    acc.showTitle = true
  } else {
    acc.itemIds.add(unit.itemId)
  }
}

// The bottom position of the block that must fit alongside this unit. For a section
// title that means the title plus its first item (orphan rule); for an item, itself.
function blockBottomFor(unit: FlowUnit, index: number, units: FlowUnit[]): number {
  if (unit.itemId !== null) return unit.bottom
  for (let i = index + 1; i < units.length; i++) {
    if (units[i].sectionType !== unit.sectionType) break
    if (units[i].itemId !== null) return units[i].bottom
  }
  return unit.bottom
}

function paginateUnits(units: FlowUnit[], usableHeight: number): PageLayout {
  const layout: PageLayout = []
  let accumulators = new Map<string, SliceAccumulator>()
  let pageTop = 0

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]
    const hasContentOnPage = accumulators.size > 0
    const requiredBottom = blockBottomFor(unit, i, units)

    if (hasContentOnPage && requiredBottom - pageTop > usableHeight) {
      commitAccumulators(layout, accumulators)
      accumulators = new Map()
      pageTop = unit.top
    }

    placeUnit(accumulators, unit)
  }

  commitAccumulators(layout, accumulators)
  return layout
}

// Merges per-column page layouts into a single layout indexed by physical page.
// Columns paginate independently (each fills its own page region top-to-bottom);
// a physical page concatenates the slices each column placed on that page index.
function mergeColumnLayouts(columnLayouts: PageLayout[]): PageLayout {
  const pageCount = columnLayouts.reduce((max, l) => Math.max(max, l.length), 0)
  const merged: PageLayout = []
  for (let i = 0; i < pageCount; i++) {
    const pageSlices: PageSectionSlice[] = []
    for (const columnLayout of columnLayouts) {
      if (columnLayout[i]) pageSlices.push(...columnLayout[i])
    }
    merged.push(pageSlices)
  }
  return merged
}

function computePageLayout(
  container: HTMLElement,
  columns: ResumeSectionDto[][],
): { layout: PageLayout; measuredHeight: number } {
  // Read the margins as resolved pixels from the container's computed padding so any
  // CSS unit (in, rem, px) the template uses is converted correctly and stays in sync
  // with what the visible pages render.
  const cs = getComputedStyle(container)
  const marginTop = Number.parseFloat(cs.paddingTop) || 0
  const marginBottom = Number.parseFloat(cs.paddingBottom) || 0
  const usableHeight = PAGE_HEIGHT_PX - marginTop - marginBottom
  let measuredHeight = 0
  const columnLayouts: PageLayout[] = []

  for (const sections of columns) {
    const units = buildFlowUnits(container, sections)
    measuredHeight = units.reduce((max, u) => Math.max(max, u.bottom), measuredHeight)
    columnLayouts.push(paginateUnits(units, usableHeight))
  }

  if (measuredHeight <= 0) {
    return { layout: [], measuredHeight: 0 }
  }

  return { layout: mergeColumnLayouts(columnLayouts), measuredHeight }
}

export function usePageLayout(columns: ResumeSectionDto[][]): UsePageLayoutResult {
  const [pageLayout, setPageLayout] = useState<PageLayout | null>(null)
  const [pageCount, setPageCount] = useState(1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const measure = useCallback(
    (container: HTMLElement, fallbackHeight?: number) => {
      const { layout, measuredHeight } = computePageLayout(container, columnsRef.current)
      if (measuredHeight > 0) {
        setPageLayout(layout.length > 0 ? layout : null)
        setPageCount(Math.max(1, layout.length))
      } else if (fallbackHeight !== undefined && fallbackHeight > 0) {
        setPageLayout(null)
        setPageCount(Math.max(1, Math.ceil(fallbackHeight / PAGE_HEIGHT_PX)))
      }
    },
    [],
  )

  const measureRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      containerRef.current = el
      if (!el) return

      const observer = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect.height ?? 0
        measure(el, height)
      })
      observer.observe(el)
      observerRef.current = observer
      measure(el)
    },
    [measure],
  )

  return { pageLayout, pageCount, measureRef }
}
