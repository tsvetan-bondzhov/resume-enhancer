import { useState, useEffect, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const RIGHT_MIN = 280
const RIGHT_MAX = 600
const RIGHT_DEFAULT = 380
const RIGHT_COLLAPSED = 48

interface SplitPaneLayoutProps {
  readonly leftSlot: React.ReactNode
  readonly centerSlot: React.ReactNode
  readonly rightSlot: React.ReactNode
}

export default function SplitPaneLayout({
  leftSlot,
  centerSlot,
  rightSlot,
}: SplitPaneLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem("sidebar-collapsed") ?? "false")
    } catch {
      return false
    }
  })

  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem("right-panel-collapsed") ?? "false")
    } catch {
      return false
    }
  })

  const [rightWidth, setRightWidth] = useState<number>(() => {
    try {
      const stored = Number(localStorage.getItem("right-panel-width"))
      return stored >= RIGHT_MIN && stored <= RIGHT_MAX ? stored : RIGHT_DEFAULT
    } catch {
      return RIGHT_DEFAULT
    }
  })

  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(0)

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("sidebar-collapsed", JSON.stringify(next))
      return next
    })
  }, [])

  const toggleRightCollapse = useCallback(() => {
    setIsRightCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("right-panel-collapsed", JSON.stringify(next))
      return next
    })
  }, [])

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = rightWidth

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return
      const delta = dragStartXRef.current - ev.clientX
      const next = Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, dragStartWidthRef.current + delta))
      setRightWidth(next)
      localStorage.setItem("right-panel-width", String(next))
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [rightWidth])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      )
        return
      if (e.key === "[") toggleCollapse()
      if (e.key === "]") toggleRightCollapse()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [toggleCollapse, toggleRightCollapse])

  const rightPanelWidth = isRightCollapsed ? RIGHT_COLLAPSED : rightWidth

  return (
    <div
      className="grid overflow-hidden"
      style={{
        height: "calc(100vh - 56px)",
        gridTemplateColumns: `${isCollapsed ? 48 : 240}px 1fr ${rightPanelWidth}px`,
        transition: "grid-template-columns 150ms ease-out",
      }}
    >
      {/* Left sidebar */}
      <div className="flex flex-col overflow-hidden border-r border-border bg-card">
        <div
          className={`flex p-2 ${isCollapsed ? "justify-center" : "justify-end"}`}
        >
          <button
            type="button"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={toggleCollapse}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {!isCollapsed && leftSlot}
        </div>
      </div>

      {/* Center column */}
      <div className="overflow-hidden">{centerSlot}</div>

      {/* Right panel */}
      <div className="relative flex border-l border-border bg-card overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10"
          onMouseDown={isRightCollapsed ? undefined : handleDragMouseDown}
          style={{ cursor: isRightCollapsed ? "default" : "col-resize" }}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className={`flex p-2 ${isRightCollapsed ? "justify-center" : "justify-start"}`}>
            <button
              type="button"
              aria-expanded={!isRightCollapsed}
              aria-label={isRightCollapsed ? "Expand chat panel" : "Collapse chat panel"}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              onClick={toggleRightCollapse}
            >
              {isRightCollapsed ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {!isRightCollapsed && rightSlot}
          </div>
        </div>
      </div>
    </div>
  )
}
