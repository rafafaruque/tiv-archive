// Hosting failures can return HTML or an empty body instead of our JSON payload.
export async function readApiResponse(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(fallback)
  }
  return payload
}
