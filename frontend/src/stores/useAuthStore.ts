import { create } from "zustand"
import type { UserDto } from "@/types/api"

interface AuthState {
  token: string | null
  user: UserDto | null
  setAuth: (token: string, user: UserDto | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set((state) => ({ ...state, token, user })),
  clearAuth: () => set((state) => ({ ...state, token: null, user: null })),
}))
