export type Step = { agent: string; tool: string; status: string }
export type Source = { source: string; title: string; content: string }
export type TransactionDraft = {
  id: string
  sku: string
  product: string
  unit: string
  currency: string
  kind: 'sale' | 'purchase'
  quantity: number
  total: string
  stock_before: number
  stock_after: number
  status: 'pending' | 'confirmed' | 'cancelled'
  transaction_id: number | null
  recorded_at: string | null
}
export type Turn = {
  question: string
  answer: string
  steps: Step[]
  sources: Source[]
  transactions: TransactionDraft[]
}
export type Conversation = { id: string; turns: Turn[] }
export type Health = {
  status: string
  llm_configured: boolean
  model: string
  reasoning_effort: string
  data_mode: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(250_000),
    })
  } catch {
    throw new Error(
      'Cannot reach the backend. Check that it is running on port 8000, then reload.',
    )
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(
      typeof data?.detail === 'string'
        ? data.detail
        : 'The request failed. Please try again.',
      response.status,
    )
  }
  return response.json() as Promise<T>
}
