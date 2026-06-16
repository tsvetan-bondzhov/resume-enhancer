import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { ThemeProvider, useTheme } from "./theme-provider"

// Helper component that reads theme context
function ThemeConsumer() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme("dark")}>dark</button>
      <button onClick={() => setTheme("light")}>light</button>
      <button onClick={() => setTheme("system")}>system</button>
    </div>
  )
}

// Minimal matchMedia mock that supports addEventListener/removeEventListener
function makeMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = []
  return vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn((_: string, fn: () => void) => {
      listeners.push(fn)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    _listeners: listeners,
  })
}

function assertKeydownToggle(
  localStorageMock: Record<string, string>,
  initialTheme: string,
  expectedTheme: string
) {
  localStorageMock["theme"] = initialTheme
  render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  )
  expect(screen.getByTestId("theme").textContent).toBe(initialTheme)
  act(() => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }))
  })
  expect(screen.getByTestId("theme").textContent).toBe(expectedTheme)
}

function assertKeydownNoToggle(
  localStorageMock: Record<string, string>,
  eventInit: KeyboardEventInit
) {
  localStorageMock["theme"] = "dark"
  render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  )
  act(() => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", eventInit))
  })
  expect(screen.getByTestId("theme").textContent).toBe("dark")
}

function assertStorageEventIgnored(eventInit: StorageEventInit) {
  render(
    <ThemeProvider defaultTheme="light">
      <ThemeConsumer />
    </ThemeProvider>
  )
  act(() => {
    globalThis.dispatchEvent(new StorageEvent("storage", eventInit))
  })
  expect(screen.getByTestId("theme").textContent).toBe("light")
}

describe("ThemeProvider", () => {
  let localStorageMock: Record<string, string>

  beforeEach(() => {
    localStorageMock = {}
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => localStorageMock[key] ?? null
    )
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key, value) => { localStorageMock[key] = value }
    )
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
      (key) => { delete localStorageMock[key] }
    )

    // Default: system is light
    globalThis.matchMedia = makeMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.classList.remove("light", "dark")
  })

  it("uses defaultTheme when localStorage has no stored theme", () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme").textContent).toBe("light")
  })

  it("uses stored theme from localStorage over defaultTheme", () => {
    localStorageMock["theme"] = "dark"
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme").textContent).toBe("dark")
  })

  it("falls back to defaultTheme when localStorage has invalid value", () => {
    localStorageMock["theme"] = "invalid-value"
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme").textContent).toBe("dark")
  })

  it("applies 'dark' class to documentElement when theme is dark", () => {
    localStorageMock["theme"] = "dark"
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("applies 'light' class to documentElement when theme is light", () => {
    localStorageMock["theme"] = "light"
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(document.documentElement.classList.contains("light")).toBe(true)
  })

  it("resolves system theme to 'dark' when prefers-color-scheme is dark", () => {
    globalThis.matchMedia = makeMatchMedia(true)
    render(
      <ThemeProvider defaultTheme="system">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("resolves system theme to 'light' when prefers-color-scheme is light", () => {
    globalThis.matchMedia = makeMatchMedia(false)
    render(
      <ThemeProvider defaultTheme="system">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(document.documentElement.classList.contains("light")).toBe(true)
  })

  it("setTheme updates the theme state and saves to localStorage", () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    )
    act(() => {
      screen.getByText("dark").click()
    })
    expect(screen.getByTestId("theme").textContent).toBe("dark")
    expect(localStorageMock["theme"]).toBe("dark")
  })

  it("uses custom storageKey for localStorage", () => {
    localStorageMock["my-theme-key"] = "dark"
    render(
      <ThemeProvider storageKey="my-theme-key" defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme").textContent).toBe("dark")
  })

  it("registers a media query listener when theme is system", () => {
    const mockMatchMedia = makeMatchMedia(false)
    globalThis.matchMedia = mockMatchMedia

    render(
      <ThemeProvider defaultTheme="system">
        <ThemeConsumer />
      </ThemeProvider>
    )

    const mediaQueryResult = mockMatchMedia.mock.results[0].value
    expect(mediaQueryResult.addEventListener).toHaveBeenCalled()
  })

  it("does not register a media query listener when theme is not system", () => {
    const mockMatchMedia = makeMatchMedia(false)
    globalThis.matchMedia = mockMatchMedia

    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    )

    // matchMedia is called once for theme application (getSystemTheme path is NOT triggered)
    // The media query listener addEventListener should NOT be called from the system-theme effect
    const calls = mockMatchMedia.mock.results
    const listenerAdded = calls.some(
      (r) => r.value.addEventListener.mock.calls.length > 0
    )
    expect(listenerAdded).toBe(false)
  })

  it("handles storage event with valid new theme — updates state", () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme").textContent).toBe("light")

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent("storage", {
          storageArea: localStorage,
          key: "theme",
          newValue: "dark",
        })
      )
    })
    expect(screen.getByTestId("theme").textContent).toBe("dark")
  })

  it("handles storage event with invalid new theme — reverts to defaultTheme", () => {
    localStorageMock["theme"] = "dark"
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    )

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent("storage", {
          storageArea: localStorage,
          key: "theme",
          newValue: "garbage",
        })
      )
    })
    expect(screen.getByTestId("theme").textContent).toBe("light")
  })

  it("ignores storage event from a different storageArea", () => {
    assertStorageEventIgnored({
      storageArea: sessionStorage,
      key: "theme",
      newValue: "dark",
    })
  })

  it("ignores storage event for a different key", () => {
    assertStorageEventIgnored({
      storageArea: localStorage,
      key: "other-key",
      newValue: "dark",
    })
  })

  it("toggles from dark to light on 'd' keydown", () => {
    assertKeydownToggle(localStorageMock, "dark", "light")
  })

  it("toggles from light to dark on 'd' keydown", () => {
    assertKeydownToggle(localStorageMock, "light", "dark")
  })

  it("does not toggle on 'd' keydown when repeat is true", () => {
    assertKeydownNoToggle(localStorageMock, { key: "d", repeat: true })
  })

  it("does not toggle on 'd' keydown when ctrlKey is held", () => {
    assertKeydownNoToggle(localStorageMock, { key: "d", ctrlKey: true })
  })

  it("does not toggle on 'd' keydown when metaKey is held", () => {
    assertKeydownNoToggle(localStorageMock, { key: "d", metaKey: true })
  })

  it("does not toggle on non-d key", () => {
    assertKeydownNoToggle(localStorageMock, { key: "x" })
  })
})

describe("useTheme — outside ThemeProvider", () => {
  it("throws an error when used outside a ThemeProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    function BadConsumer() {
      const { theme } = useTheme()
      return <span>{theme}</span>
    }
    expect(() => render(<BadConsumer />)).toThrow(
      "useTheme must be used within a ThemeProvider"
    )
    spy.mockRestore()
  })
})
