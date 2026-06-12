import { NavLink } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/useAuthStore"
import { useSignOut } from "@/hooks/useSignOut"

interface AppShellProps {
  readonly children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const user = useAuthStore((state) => state.user)
  const signOut = useSignOut()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"
        >
          <span className="text-lg font-semibold">Resume Enhancer</span>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  isActive
                    ? "text-sm font-medium text-blue-600"
                    : "text-sm text-zinc-600 hover:text-zinc-900"
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  isActive
                    ? "text-sm font-medium text-blue-600"
                    : "text-sm text-zinc-600 hover:text-zinc-900"
                }
              >
                Profile
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  isActive
                    ? "text-sm font-medium text-blue-600"
                    : "text-sm text-zinc-600 hover:text-zinc-900"
                }
              >
                Settings
              </NavLink>
              {user?.role === "ADMIN" && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    isActive
                      ? "text-sm font-medium text-blue-600"
                      : "text-sm text-zinc-600 hover:text-zinc-900"
                  }
                >
                  Admin
                </NavLink>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
