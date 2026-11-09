export function csrfToken(): string | null {
  const prefix = "XSRF-TOKEN="
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length))
    }
  }
  return null
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const method = (init.method ?? "GET").toUpperCase()
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const token = csrfToken()
    if (token) {
      headers.set("X-XSRF-TOKEN", token)
    }
  }
  return fetch(path, {
    ...init,
    headers,
    credentials: "include",
  })
}
