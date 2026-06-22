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
  height: number
}

interface SliceAccumulator {
  sectionType: string
  showTitle: boolean
  itemIds: Set<string>
}

// Builds an ordered list of measurable units (one per section title, one per item)
// with margin-inclusive heights derived from the distance between consecutive flow
// positions. Using deltas captures the margins/gaps that getBoundingClientRect omits.
function buildFlowUnits(container: HTMLElement, sections: ResumeSectionDto[]): FlowUnit[] {
  const points: { sectionType: string; itemId: string | null; top: number }[] = []

  for (const section of sections) {
    const sectionEl = container.querySelector<HTMLElement>(
      `[data-section-type="${section.sectionType}"]`,
    )
    if (!sectionEl) continue

    const titleEl = sectionEl.querySelector("h2")
    if (titleEl) {
      points.push({
        sectionType: section.sectionType,
        itemId: null,
        top: titleEl.getBoundingClientRect().top,
      })
    }

    for (const item of section.items) {
      const el = sectionEl.querySelector<HTMLElement>(`[data-item-id="${item.id}"]`)
      if (el) {
        points.push({
          sectionType: section.sectionType,
          itemId: item.id,
          top: el.getBoundingClientRect().top,
        })
      }
    }
  }

  if (points.length === 0) return []

  const padBottom = Number.parseFloat(getComputedStyle(container).paddingBottom) || 0
  const contentBottom = container.getBoundingClientRect().bottom - padBottom

  return points.map((point, i) => {
    const nextTop = i + 1 < points.length ? points[i + 1].top : contentBottom
    return {
      sectionType: point.sectionType,
      itemId: point.itemId,
      height: Math.max(0, nextTop - point.top),
    }
  })
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

// Returns true when placing this unit requires breaking to a new page first.
function shouldBreakBefore(
  unit: FlowUnit,
  nextUnit: FlowUnit | undefined,
  cursor: number,
  usableHeight: number,
): boolean {
  if (cursor <= 0) return false

  if (unit.itemId === null) {
    // Title: must not be orphaned — require room for the title plus its first item.
    const nextIsFirstItem =
      nextUnit?.sectionType === unit.sectionType && nextUnit?.itemId !== null
    const firstItemHeight = nextIsFirstItem ? (nextUnit?.height ?? 0) : 0
    return cursor + unit.height + firstItemHeight > usableHeight
  }

  // Item: never split — push the whole item to the next page if it does not fit.
  return cursor + unit.height > usableHeight
}

function paginateUnits(units: FlowUnit[], usableHeight: number): PageLayout {
  const layout: PageLayout = []
  let accumulators = new Map<string, SliceAccumulator>()
  let cursor = 0

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]
    if (shouldBreakBefore(unit, units[i + 1], cursor, usableHeight)) {
      commitAccumulators(layout, accumulators)
      accumulators = new Map()
      cursor = 0
    }
    placeUnit(accumulators, unit)
    cursor += unit.height
  }

  commitAccumulators(layout, accumulators)
  return layout
}

function computePageLayout(
  container: HTMLElement,
  sections: ResumeSectionDto[],
  marginTop: number,
  marginBottom: number,
): { layout: PageLayout; measuredHeight: number } {
  const usableHeight = PAGE_HEIGHT_PX - marginTop - marginBottom
  const units = buildFlowUnits(container, sections)
  const measuredHeight = units.reduce((sum, u) => sum + u.height, 0)

  if (measuredHeight <= 0) {
    return { layout: [], measuredHeight: 0 }
  }

  return { layout: paginateUnits(units, usableHeight), measuredHeight }
}

export function usePageLayout(
  sections: ResumeSectionDto[],
  marginTop: number,
  marginBottom: number,
): UsePageLayoutResult {
  const [pageLayout, setPageLayout] = useState<PageLayout | null>(null)
  const [pageCount, setPageCount] = useState(1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const sectionsRef = useRef(sections)
  const marginTopRef = useRef(marginTop)
  const marginBottomRef = useRef(marginBottom)
  sectionsRef.current = sections
  marginTopRef.current = marginTop
  marginBottomRef.current = marginBottom

  const measure = useCallback(
    (container: HTMLElement, fallbackHeight?: number) => {
      const { layout, measuredHeight } = computePageLayout(
        container,
        sectionsRef.current,
        marginTopRef.current,
        marginBottomRef.current,
      )
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
