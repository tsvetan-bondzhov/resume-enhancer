import "@testing-library/jest-dom"

// jsdom does not implement ResizeObserver. Provide a no-op stub so any component
// that uses ResizeObserver can render without throwing in tests.
//
// Tests that need to manually fire the observer callback should import
// `resizeObserverTracker` and invoke `resizeObserverTracker.last?.callback(...)`.

export interface ResizeObserverStubInstance {
  callback: ResizeObserverCallback
  observe(): void
  unobserve(): void
  disconnect(): void
}

/** Tracks the most recently constructed ResizeObserver stub instance. */
export const resizeObserverTracker: { last: ResizeObserverStubInstance | null } = { last: null }

class ResizeObserverStub implements ResizeObserverStubInstance {
  callback: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb
    resizeObserverTracker.last = this
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  observe(_target: Element) { /* no-op */ }
  unobserve() { /* no-op */ }
  disconnect() { /* no-op */ }
}

globalThis.ResizeObserver = ResizeObserverStub
