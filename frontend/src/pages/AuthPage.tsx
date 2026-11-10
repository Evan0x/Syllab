import { LogIn, UserPlus } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { AuthError, loginAccount, registerAccount, type Account } from "../api/auth.ts"
import { csrfToken } from "../api/http.ts"
import { Button } from "../components/Button.tsx"
import { SiteHeader } from "../components/SiteHeader.tsx"
import { TextField } from "../components/TextField.tsx"

type AuthPageProps = {
  onAuthenticated: (account: Account) => void
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!csrfToken()) {
      setError("Could not start a secure session. Refresh the page and try again.")
      return
    }
    setSubmitting(true)
    setError(undefined)
    try {
      if (mode === "register") {
        await registerAccount({ email, password, inviteCode })
      }
      onAuthenticated(await loginAccount({ email, password }))
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : "Could not sign in")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[440px] flex-col gap-8 px-6 py-16">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-[40px] leading-none tracking-[-0.8px] text-ink">
            {mode === "login" ? "Sign in" : "Create an account"}
          </h1>
          <p className="text-[14px] leading-[1.5] text-muted">
            {mode === "login"
              ? "Use the email and password for your Syllapin account."
              : "Registration needs an invite code. Your password must be at least 10 characters."}
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            id="email"
            label="Email"
            value={email}
            placeholder="you@school.edu"
            autoComplete="email"
            onChange={setEmail}
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            value={password}
            placeholder="At least 10 characters"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={setPassword}
          />
          {mode === "register" ? (
            <TextField
              id="invite-code"
              label="Invite code"
              value={inviteCode}
              placeholder="Invite code"
              autoComplete="off"
              onChange={setInviteCode}
            />
          ) : null}
          {error ? (
            <p role="alert" className="text-[13px] leading-[1.45] text-error">
              {error}
            </p>
          ) : null}
          <Button icon={mode === "login" ? LogIn : UserPlus} type="submit" disabled={submitting}>
            {submitting ? "Please wait" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          className="self-start text-[13px] text-muted hover:text-ink"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login")
            setError(undefined)
          }}
        >
          {mode === "login" ? "Have an invite code? Create an account" : "Already have an account? Sign in"}
        </button>
      </main>
    </div>
  )
}
