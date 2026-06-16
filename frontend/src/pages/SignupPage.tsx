import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { apiClient, ApiError } from "@/lib/apiClient"
import { useAuthStore } from "@/stores/useAuthStore"
import type { AuthResponse, SignupRequest } from "@/types/api"
import {
  AuthEmailField,
  AuthPasswordField,
  AuthSubmitButton,
  applyFieldValidationErrors,
  type FieldErrors,
} from "@/components/auth/authShared"

function applySignupError(err: unknown, setFieldErrors: (e: FieldErrors) => void): void {
  if (!(err instanceof ApiError)) {
    toast.error("Registration failed. Please try again.")
    return
  }
  if (err.status === 409) {
    toast.error("An account with this email already exists")
    return
  }
  if (applyFieldValidationErrors(err, setFieldErrors)) return
  toast.error(err.detail || "Registration failed. Please try again.")
}

export default function SignupPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setIsSubmitting(true)

    const request: SignupRequest = { email, password }

    try {
      const response = await apiClient.post<AuthResponse>("/api/v1/auth/signup", request)
      // Backend returns only { token } — user profile will be fetched on app load (Story 2.x).
      setAuth(response.token, response.user ?? null)
      navigate("/")
    } catch (err) {
      applySignupError(err, setFieldErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-background p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to get started
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
            autoComplete="new-password"
            placeholder="Min. 8 characters"
          />
          <AuthSubmitButton
            isSubmitting={isSubmitting}
            label="Create Account"
            loadingLabel="Creating account…"
          />
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="underline underline-offset-4 hover:text-foreground">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
