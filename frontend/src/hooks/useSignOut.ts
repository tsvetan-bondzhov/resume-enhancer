import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/useAuthStore"

export function useSignOut() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  return () => {
    clearAuth()
    navigate("/login", { replace: true })
  }
}
