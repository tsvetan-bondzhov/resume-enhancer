import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("sidebar-collapsed", JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "[") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      )
        return
      toggleCollapse()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [toggleCollapse])

  return (
    <div
      className="grid overflow-hidden"
      style={{
        height: "calc(100vh - 56px)",
        gridTemplateColumns: `${isCollapsed ? 48 : 240}px 1fr 288px`,
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
      <div className="border-l border-border bg-card overflow-hidden">
        {rightSlot}
      </div>
    </div>
  )
}
