import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/apiClient"
import type { AdminUserDto, Page } from "@/types/api"

function formatCreatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d)
}

export default function UserTable() {
  const [users, setUsers] = useState<AdminUserDto[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [target, setTarget] = useState<AdminUserDto | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<Page<AdminUserDto>>("/api/v1/admin/users")
      .then((page) => {
        if (!cancelled) {
          setUsers(page.content)
          setLoadError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          toast.error("Failed to load users")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUsers(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // UX-DR19: Cancel button is default-focused when the confirm dialog opens.
  useEffect(() => {
    if (target) {
      const id = setTimeout(() => cancelRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [target])

  const closeDialog = () => {
    if (!deactivatingId) setTarget(null)
  }

  const handleConfirmDeactivate = async () => {
    if (!target) return
    const userId = target.id
    setDeactivatingId(userId)
    try {
      const updated = await apiClient.patch<AdminUserDto>(
        `/api/v1/admin/users/${userId}/deactivate`,
      )
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: updated.status } : u)),
      )
      toast.success("User deactivated")
      setTarget(null)
    } catch {
      toast.error("Failed to deactivate user")
    } finally {
      setDeactivatingId(null)
    }
  }

  if (isLoadingUsers) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (loadError) {
    return <p className="text-sm text-destructive">Failed to load users.</p>
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Email</th>
              <th scope="col" className="px-4 py-2 font-medium">Role</th>
              <th scope="col" className="px-4 py-2 font-medium">Status</th>
              <th scope="col" className="px-4 py-2 font-medium">Created</th>
              <th scope="col" className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isInactive = user.status === "INACTIVE"
                return (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{user.email}</td>
                    <td className="px-4 py-2">{user.role}</td>
                    <td className="px-4 py-2">
                      <Badge variant={isInactive ? "destructive" : "secondary"}>
                        {isInactive ? "Inactive" : "Active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{formatCreatedAt(user.createdAt)}</td>
                    <td className="px-4 py-2">
                      {!isInactive && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setTarget(user)}
                          disabled={deactivatingId === user.id}
                        >
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={target !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeDialog()
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Deactivate user</DialogTitle>
            <DialogDescription>
              {target
                ? `Deactivate ${target.email}? Their resumes will be preserved.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelRef}
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={deactivatingId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeactivate}
              disabled={deactivatingId !== null}
            >
              {deactivatingId === null ? "Deactivate" : "Deactivating…"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
