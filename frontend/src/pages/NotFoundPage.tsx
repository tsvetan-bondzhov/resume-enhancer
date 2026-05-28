import { Link } from "react-router-dom"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-background p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">404 — Page Not Found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          to="/"
          className="text-sm underline underline-offset-4 hover:text-foreground"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
