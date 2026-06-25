import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
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
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/apiClient"
import { useAuthStore } from "@/stores/useAuthStore"
import type { AdminUserDto, AuthResponse, Page } from "@/types/api"

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
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [users, setUsers] = useState<AdminUserDto[]>([])
  const [search, setSearch] = useState("")
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [target, setTarget] = useState<AdminUserDto | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)
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

  const handleActivate = async (user: AdminUserDto) => {
    const userId = user.id
    setActivatingId(userId)
    try {
      const updated = await apiClient.patch<AdminUserDto>(
        `/api/v1/admin/users/${userId}/activate`,
      )
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: updated.status } : u)),
      )
      toast.success("User activated")
    } catch {
      toast.error("Failed to activate user")
    } finally {
      setActivatingId(null)
    }
  }

  const handleImpersonate = async (user: AdminUserDto) => {
    const userId = user.id
    setImpersonatingId(userId)
    try {
      const response = await apiClient.post<AuthResponse>(
        `/api/v1/admin/users/${userId}/impersonate`,
        {},
      )
      setAuth(response.token, response.user ?? null)
      toast.success(`Now acting as ${user.email}`)
      navigate("/")
    } catch {
      toast.error("Failed to impersonate user")
    } finally {
      setImpersonatingId(null)
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

  const query = search.trim().toLowerCase()
  const filteredUsers = query
    ? users.filter((user) =>
        [user.email, user.role, user.status].some((field) =>
          field.toLowerCase().includes(query),
        ),
      )
    : users

  return (
    <>
      <div className="mb-4">
        <Input
          type="search"
          placeholder="Search by email, role, or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
      </div>
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
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
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
                      {isInactive ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleActivate(user)}
                          disabled={activatingId === user.id}
                        >
                          {activatingId === user.id ? "Activating…" : "Activate"}
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleImpersonate(user)}
                            disabled={impersonatingId === user.id}
                          >
                            {impersonatingId === user.id ? "Impersonating…" : "Impersonate"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setTarget(user)}
                            disabled={deactivatingId === user.id}
                          >
                            Deactivate
                          </Button>
                        </div>
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
