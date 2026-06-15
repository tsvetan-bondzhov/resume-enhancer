import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { apiClient, ApiError } from "@/lib/apiClient"
import { useAuthStore } from "@/stores/useAuthStore"
import type { AuthResponse, LoginRequest } from "@/types/api"
import {
  AuthEmailField,
  AuthPasswordField,
  AuthSubmitButton,
  applyFieldValidationErrors,
  type FieldErrors,
} from "@/components/auth/authShared"

function applyLoginError(err: unknown, setFieldErrors: (e: FieldErrors) => void): void {
  if (!(err instanceof ApiError)) {
    toast.error("Sign in failed. Please try again.")
    return
  }
  if (err.status === 401) {
    toast.error("Invalid email or password")
    return
  }
  if (applyFieldValidationErrors(err, setFieldErrors)) return
  toast.error(err.detail || "Sign in failed. Please try again.")
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const token = useAuthStore((state) => state.token)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (token) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setIsSubmitting(true)

    const request: LoginRequest = { email, password }

    try {
      const response = await apiClient.post<AuthResponse>("/api/v1/auth/login", request)
      setAuth(response.token, response.user ?? null)
      navigate("/")
    } catch (err) {
      applyLoginError(err, setFieldErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-background p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to access your account
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <AuthEmailField
            value={email}
            onChange={setEmail}
            fieldError={fieldErrors.email}
            disabled={isSubmitting}
          />
          <AuthPasswordField
            value={password}
            onChange={setPassword}
            fieldError={fieldErrors.password}
            disabled={isSubmitting}
            autoComplete="current-password"
            placeholder="Your password"
          />
          <AuthSubmitButton
            isSubmitting={isSubmitting}
            label="Sign In"
            loadingLabel="Signing in…"
          />
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="underline underline-offset-4 hover:text-foreground">
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
