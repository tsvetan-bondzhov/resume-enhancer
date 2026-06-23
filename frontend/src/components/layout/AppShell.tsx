import { NavLink } from "react-router-dom"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/useAuthStore"
import { useSignOut } from "@/hooks/useSignOut"
import { useTheme } from "@/components/theme-provider"

interface AppShellProps {
  readonly children: React.ReactNode
}

function getSystemTheme(): "dark" | "light" {
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export default function AppShell({ children }: AppShellProps) {
  const user = useAuthStore((state) => state.user)
  const signOut = useSignOut()
  const { theme, setTheme } = useTheme()

  const resolvedTheme: "dark" | "light" = theme === "system" ? getSystemTheme() : theme

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={
                resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
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
