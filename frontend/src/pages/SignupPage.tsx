import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient, ApiError } from "@/lib/apiClient"
import { useAuthStore } from "@/stores/useAuthStore"
import type { AuthResponse, SignupRequest } from "@/types/api"

interface FieldErrors {
  email?: string
  password?: string
}

function applySignupError(err: unknown, setFieldErrors: (e: FieldErrors) => void): void {
  if (!(err instanceof ApiError)) {
    toast.error("Registration failed. Please try again.")
    return
  }
  if (err.status === 409) {
    toast.error("An account with this email already exists")
    return
  }
  if (err.status === 400 && err.errors) {
    const errors: FieldErrors = {}
    if (err.errors["email"]?.[0]) errors.email = err.errors["email"][0]
    if (err.errors["password"]?.[0]) errors.password = err.errors["password"][0]
    setFieldErrors(errors)
    if (!errors.email && !errors.password) {
      toast.error(err.detail)
    }
    return
  }
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
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium leading-none">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              disabled={isSubmitting}
            />
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="text-sm text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium leading-none">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              disabled={isSubmitting}
            />
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="text-sm text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </Button>
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
