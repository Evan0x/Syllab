import { apiFetch } from "./http.ts"

export type Account = {
  id: string
  email: string
}

export class AuthError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AuthError"
    this.status = status
  }
}

export async function currentAccount(): Promise<Account | null> {
  const response = await apiFetch("/api/me")
  if (response.status === 401) {
    return null
  }
  if (!response.ok) {
    throw new AuthError(await readMessage(response, "Could not load your account"), response.status)
  }
  return readAccount(response)
}

export async function registerAccount(input: {
  email: string
  password: string
  inviteCode: string
}): Promise<Account> {
  const response = await apiFetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new AuthError(await readMessage(response, "Could not create an account"), response.status)
  }
  return readAccount(response)
}

export async function loginAccount(input: { email: string; password: string }): Promise<Account> {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new AuthError(await readMessage(response, "Invalid email or password"), response.status)
  }
  return readAccount(response)
}

export async function logoutAccount(): Promise<void> {
  const response = await apiFetch("/api/auth/logout", { method: "POST" })
  if (!response.ok && response.status !== 204) {
    throw new AuthError(await readMessage(response, "Could not log out"), response.status)
  }
}

async function readAccount(response: Response): Promise<Account> {
  const data: unknown = await response.json()
  if (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "email" in data &&
    typeof data.id === "string" &&
    typeof data.email === "string"
  ) {
    return { id: data.id, email: data.email }
  }
  throw new AuthError("Could not load your account", response.status)
}

async function readMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string" &&
      data.message.length > 0
    ) {
      return data.message
    }
  } catch {
    // The error body was not JSON.
  }
  return fallback
}
