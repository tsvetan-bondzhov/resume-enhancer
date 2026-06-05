import { Skeleton } from "@/components/ui/skeleton"

export default function ResumeDashboardCardSkeleton() {
  return (
    <div aria-label="Loading resume card" className="rounded-xl border border-border overflow-hidden">
      <Skeleton className="aspect-[1/1.414] w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}
