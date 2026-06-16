import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useAuthStore } from "@/stores/useAuthStore"

// ── Mock fetch globally ──────────────────────────────────────────────────────
// We stub globalThis.fetch before importing apiClient so that all calls go
// through our mock.
const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  // Reset auth state so each test starts with no token
  useAuthStore.setState({ token: null, user: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// Import AFTER stubs are set up (dynamic import ensures fresh module state)
// We use a static import instead and rely on the mock being in place.
import { apiClient, ApiError } from "./apiClient"

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(status: number, body?: unknown, ok?: boolean): Response {
  const isOk = ok ?? (status >= 200 && status < 300)
  return {
    ok: isOk,
    status,
    statusText: status === 401 ? "Unauthorized" : "Error",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

// ── ApiError constructor ──────────────────────────────────────────────────────

describe("ApiError", () => {
  it("sets name, status, detail, and optional errors", () => {
    const err = new ApiError(422, "Validation failed", { email: ["is invalid"] })
    expect(err.name).toBe("ApiError")
    expect(err.status).toBe(422)
    expect(err.detail).toBe("Validation failed")
    expect(err.errors).toEqual({ email: ["is invalid"] })
    expect(err.message).toBe("Validation failed")
  })

  it("works without the optional errors parameter", () => {
    const err = new ApiError(500, "Server error")
    expect(err.errors).toBeUndefined()
  })
})

// ── request() — 401 handling ─────────────────────────────────────────────────

describe("apiClient — 401 handling", () => {
  it("clears auth and throws ApiError(401) when server returns 401", async () => {
    useAuthStore.setState({ token: "some-token", user: null })
    mockFetch.mockResolvedValue(makeResponse(401, undefined, false))

    // Stub globalThis.location so the redirect check does not throw in jsdom
    vi.stubGlobal("location", { pathname: "/dashboard", href: "" })

    await expect(apiClient.get("/api/v1/resumes")).rejects.toBeInstanceOf(ApiError)

    const { token } = useAuthStore.getState()
    expect(token).toBeNull()
  })

  it("does not redirect when current pathname starts with /login", async () => {
    mockFetch.mockResolvedValue(makeResponse(401, undefined, false))
    vi.stubGlobal("location", { pathname: "/login", href: "" })

    await expect(apiClient.get("/api/v1/resumes")).rejects.toMatchObject({ status: 401 })
  })

  it("does not redirect when current pathname starts with /signup", async () => {
    mockFetch.mockResolvedValue(makeResponse(401, undefined, false))
    vi.stubGlobal("location", { pathname: "/signup", href: "" })

    await expect(apiClient.get("/api/v1/resumes")).rejects.toMatchObject({ status: 401 })
  })
})

// ── request() — non-ok with JSON body ────────────────────────────────────────

describe("apiClient — non-ok responses", () => {
  it("throws ApiError with detail and errors from JSON body", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(422, { detail: "Invalid input", errors: { name: ["too short"] } }, false)
    )

    await expect(apiClient.post("/api/v1/resumes", {})).rejects.toMatchObject({
      status: 422,
      detail: "Invalid input",
      errors: { name: ["too short"] },
    })
  })

  it("throws ApiError using statusText when JSON body parse fails", async () => {
    const badJsonResponse = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as unknown as Response
    mockFetch.mockResolvedValue(badJsonResponse)

    await expect(apiClient.get("/api/v1/resumes")).rejects.toMatchObject({
      status: 503,
      detail: "Service Unavailable",
    })
  })

  it("throws ApiError using statusText when body has no detail field", async () => {
    mockFetch.mockResolvedValue(makeResponse(400, { message: "bad" }, false))

    await expect(apiClient.get("/api/v1/resumes")).rejects.toMatchObject({
      status: 400,
      detail: "Error",
    })
  })
})

// ── request() — 204 No Content ────────────────────────────────────────────────

describe("apiClient — 204 No Content", () => {
  it("returns undefined for 204 responses", async () => {
    mockFetch.mockResolvedValue(makeResponse(204, undefined))

    const result = await apiClient.delete("/api/v1/resumes/1")
    expect(result).toBeUndefined()
  })
})

// ── request() — 200 success ───────────────────────────────────────────────────

describe("apiClient — 200 success", () => {
  it("returns parsed JSON for 200 response", async () => {
    const data = { id: "r1", name: "My Resume" }
    mockFetch.mockResolvedValue(makeResponse(200, data))

    const result = await apiClient.get<typeof data>("/api/v1/resumes/r1")
    expect(result).toEqual(data)
  })
})

// ── request() — Authorization header ─────────────────────────────────────────

describe("apiClient — Authorization header", () => {
  it("includes Bearer token when token is in auth store", async () => {
    useAuthStore.setState({ token: "my-jwt-token", user: null })
    const data = { id: "r1" }
    mockFetch.mockResolvedValue(makeResponse(200, data))

    await apiClient.get("/api/v1/resumes/r1")

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer my-jwt-token")
  })

  it("omits Authorization header when no token is stored", async () => {
    useAuthStore.setState({ token: null, user: null })
    mockFetch.mockResolvedValue(makeResponse(200, {}))

    await apiClient.get("/api/v1/resumes/r1")

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["Authorization"]).toBeUndefined()
  })
})

// ── request() — Content-Type header ──────────────────────────────────────────

describe("apiClient — Content-Type header", () => {
  it("includes Content-Type application/json when body is present and not FormData", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}))

    await apiClient.post("/api/v1/resumes", { name: "New Resume" })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("omits Content-Type when uploading FormData", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}))
    const formData = new FormData()
    formData.append("file", new Blob(["content"]), "resume.pdf")

    await apiClient.uploadFile("/api/v1/upload", formData)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["Content-Type"]).toBeUndefined()
  })
})

// ── HTTP method routing ───────────────────────────────────────────────────────

describe("apiClient — method routing", () => {
  it("uses GET for apiClient.get", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}))
    await apiClient.get("/api/v1/resumes")
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init?.method).toBeUndefined() // fetch default is GET (no method set)
  })

  it("uses PUT for apiClient.put", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}))
    await apiClient.put("/api/v1/resumes/r1", { name: "Updated" })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init?.method).toBe("PUT")
  })

  it("uses DELETE for apiClient.delete", async () => {
    mockFetch.mockResolvedValue(makeResponse(204, undefined))
    await apiClient.delete("/api/v1/resumes/r1")
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init?.method).toBe("DELETE")
  })
})
