export class MockApiError extends Error {
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
