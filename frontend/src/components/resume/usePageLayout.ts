import { useState, useCallback, useRef } from "react"
import type { ResumeSectionDto } from "@/types/api"
import { PAGE_HEIGHT_PX } from "./resumeConstants"

export interface PageSectionSlice {
  sectionType: string
  visibleItemIds: ReadonlySet<string>
}

export type PageLayout = PageSectionSlice[][]

interface UsePageLayoutResult {
  pageLayout: PageLayout | null
  pageCount: number
  measureRef: React.RefCallback<HTMLDivElement>
}

interface ItemMeasurement {
  id: string
  height: number
}

interface PageState {
  layout: PageLayout
  currentPage: PageSectionSlice[]
  cursor: number
}

function measureTitleHeight(sectionEl: HTMLElement): number {
  const titleEl = sectionEl.querySelector("h2")
  return titleEl ? titleEl.getBoundingClientRect().height : 0
}

function measureItems(
  sectionEl: HTMLElement,
  section: ResumeSectionDto,
): { measurements: ItemMeasurement[]; totalHeight: number } {
  const measurements: ItemMeasurement[] = []
  let totalHeight = 0
  for (const item of section.items) {
    const el = sectionEl.querySelector<HTMLElement>(`[data-item-id="${item.id}"]`)
    const h = el ? el.getBoundingClientRect().height : 0
    measurements.push({ id: item.id, height: h })
    totalHeight += h
  }
  return { measurements, totalHeight }
}

function commitPage(state: PageState, marginTop: number): void {
  state.layout.push(state.currentPage)
  state.currentPage = []
  state.cursor = marginTop
}

function placeEmptySection(
  state: PageState,
  section: ResumeSectionDto,
  sectionHeight: number,
  usableHeight: number,
  marginTop: number,
): void {
  if (state.cursor + sectionHeight > usableHeight && state.cursor > marginTop) {
    commitPage(state, marginTop)
  }
  state.currentPage.push({ sectionType: section.sectionType, visibleItemIds: new Set() })
  state.cursor += sectionHeight
}

function collectPageItems(
  state: PageState,
  remainingItems: ItemMeasurement[],
  titleHeight: number,
  usableHeight: number,
  marginTop: number,
): { pageItemIds: Set<string>; consumed: number } {
  const firstItemHeight = remainingItems[0]?.height ?? 0
  if (state.cursor + titleHeight + firstItemHeight > usableHeight && state.cursor > marginTop) {
    commitPage(state, marginTop)
  }

  const pageItemIds = new Set<string>()
  state.cursor += titleHeight

  let consumed = 0
  for (const item of remainingItems) {
    if (state.cursor + item.height > usableHeight && pageItemIds.size > 0) {
      break
    }
    pageItemIds.add(item.id)
    state.cursor += item.height
    consumed++
  }
  return { pageItemIds, consumed }
}

function computePageLayout(
  container: HTMLElement,
  sections: ResumeSectionDto[],
  marginTop: number,
  marginBottom: number,
): { layout: PageLayout; measuredHeight: number } {
  const usableHeight = PAGE_HEIGHT_PX - marginTop - marginBottom
  const state: PageState = { layout: [], currentPage: [], cursor: marginTop }
  let totalMeasuredHeight = 0

  for (const section of sections) {
    const sectionEl = container.querySelector<HTMLElement>(
      `[data-section-type="${section.sectionType}"]`,
    )
    if (!sectionEl) continue

    const titleHeight = measureTitleHeight(sectionEl)

    if (section.items.length === 0) {
      const sectionHeight = sectionEl.getBoundingClientRect().height
      totalMeasuredHeight += sectionHeight
      placeEmptySection(state, section, sectionHeight, usableHeight, marginTop)
      continue
    }

    const { measurements, totalHeight } = measureItems(sectionEl, section)
    totalMeasuredHeight += totalHeight + titleHeight

    let firstItemIndex = 0
    while (firstItemIndex < measurements.length) {
      const remaining = measurements.slice(firstItemIndex)
      const { pageItemIds, consumed } = collectPageItems(state, remaining, titleHeight, usableHeight, marginTop)
      firstItemIndex += consumed
      state.currentPage.push({ sectionType: section.sectionType, visibleItemIds: pageItemIds })
      if (firstItemIndex < measurements.length) {
        commitPage(state, marginTop)
      }
    }
  }

  if (state.currentPage.length > 0) {
    state.layout.push(state.currentPage)
  }

  return { layout: state.layout, measuredHeight: totalMeasuredHeight }
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
