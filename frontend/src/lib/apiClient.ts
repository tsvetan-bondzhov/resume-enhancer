import { useAuthStore } from "@/stores/useAuthStore"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

export class ApiError extends Error {
  status: number
  detail: string
  errors?: Record<string, string[]>

  constructor(status: number, detail: string, errors?: Record<string, string[]>) {
    super(detail)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
    this.errors = errors
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token
  const hasBody = init?.body !== undefined
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 401) {
    useAuthStore.getState().clearAuth()
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')) {
      window.location.href = '/login'
    }
    throw new ApiError(401, "Unauthorized")
  }
  if (!res.ok) {
    let detail = res.statusText
    let errors: Record<string, string[]> | undefined
    try {
      const body = await res.json()
      detail = body.detail ?? detail
      if (body.errors && typeof body.errors === "object") {
        errors = body.errors as Record<string, string[]>
      }
    } catch {
      // response body is not JSON (e.g. HTML error page) — use statusText
    }
    throw new ApiError(res.status, detail, errors)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
