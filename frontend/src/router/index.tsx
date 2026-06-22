/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from "react"
import {
  createBrowserRouter,
  Navigate,
  Outlet,
} from "react-router-dom"
import { useAuthStore } from "@/stores/useAuthStore"
import { Skeleton } from "@/components/ui/skeleton"
import AppShell from "@/components/layout/AppShell"
import LoginPage from "@/pages/LoginPage"
import SignupPage from "@/pages/SignupPage"
import DashboardPage from "@/pages/DashboardPage"
import EditorPage from "@/pages/EditorPage"
import ProfilePage from "@/pages/ProfilePage"
import SettingsPage from "@/pages/SettingsPage"
import NotFoundPage from "@/pages/NotFoundPage"
import AiTestPage from "@/pages/AiTestPage"

const AdminPage = lazy(() => import("@/pages/AdminPage"))

function ProtectedRoute({ requireAdmin = false }: Readonly<{ requireAdmin?: boolean }>) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (requireAdmin && user?.role !== "ADMIN") return <Navigate to="/" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <DashboardPage />,
      },
      {
        path: "/resumes/:id",
        element: <EditorPage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/settings",
        element: <SettingsPage />,
      },
      {
        path: "/ai-test",
        element: <AiTestPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute requireAdmin />,
    children: [
      {
        path: "/admin",
        element: (
          <Suspense fallback={<Skeleton className="h-screen w-full" />}>
            <AdminPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])
