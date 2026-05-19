export interface SseHandlers {
  onToken: (data: { token: string }) => void
  onPatch: (data: {
    sectionId: string
    itemIndex: number
    field: string
    newValue: string
  }) => void
  onDone: (data: { summary: string }) => void
  onError: (data: { detail: string }) => void
}

export function createSseConnection(
  url: string,
  handlers: SseHandlers,
): () => void {
  const es = new EventSource(url)
  es.addEventListener("token", (e) =>
    handlers.onToken(JSON.parse((e as MessageEvent).data)),
  )
  es.addEventListener("patch", (e) =>
    handlers.onPatch(JSON.parse((e as MessageEvent).data)),
  )
  es.addEventListener("done", (e) => {
    handlers.onDone(JSON.parse((e as MessageEvent).data))
    es.close()
  })
  es.addEventListener("error", (e) => {
    if ((e as MessageEvent).data) {
      handlers.onError(JSON.parse((e as MessageEvent).data))
    } else {
      handlers.onError({ detail: "SSE connection error" })
    }
    es.close()
  })
  return () => es.close()
}
