import { useState } from "react"
import type { FormEvent } from "react"
import { AuthError, upgradeGuest } from "../api/auth.ts"
import { AuthField } from "../components/login/AuthField.tsx"
import { PageShell } from "../components/PageShell.tsx"
import { usePageTitle } from "../lib/pageTitle.ts"

type Phase = "form" | "verify"

export function GuestUpgradePage({ email, onLogout }: { email: string; onLogout: () => void }) {
  usePageTitle("Create your account · Syllapin")
  const [phase, setPhase] = useState<Phase>("form")
  const [newEmail, setNewEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailIssue, setEmailIssue] = useState<string>()
  const [passwordIssue, setPasswordIssue] = useState<string>()
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [upgradedEmail, setUpgradedEmail] = useState("")

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = newEmail.trim()
    const emailErr = !trimmed ? "Enter your email address." : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? "Enter a valid email address." : undefined
    const passErr = !password ? "Enter a password." : password.length < 10 ? "Password must be at least 10 characters." : undefined
    setEmailIssue(emailErr)
    setPasswordIssue(passErr)
    if (emailErr || passErr) {
      document.getElementById("upgrade-email")?.focus()
      return
    }
    setSubmitting(true)
    setError(undefined)
    try {
      await upgradeGuest({ email: trimmed, password })
      setUpgradedEmail(trimmed)
      setPhase("verify")
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : "Could not create your account")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell email={email} onLogout={onLogout} isGuest>
      <div className="mx-auto w-full max-w-[480px] py-4">
        {phase === "form" ? (
          <div className="panel flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium tracking-[0.1em] text-muted uppercase">Guest account</p>
              <h1 className="text-[22px] font-medium tracking-[-0.025em] text-ink">Save your work</h1>
              <p className="text-[13px] leading-5 text-muted">
                You've used both free previews. Create a free account to upload more syllabi and keep your calendar.
              </p>
            </div>
            <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
              <AuthField
                id="upgrade-email"
                label="Email address"
                type="email"
                value={newEmail}
                placeholder="you@university.edu"
                autoComplete="email"
                error={emailIssue}
                onChange={(v) => { setNewEmail(v); setEmailIssue(undefined) }}
              />
              <AuthField
                id="upgrade-password"
                label="Password"
                type="password"
                value={password}
                placeholder="At least 10 characters"
                autoComplete="new-password"
                error={passwordIssue}
                hint={password.length >= 10 ? "Strong enough to continue." : "Use at least 10 characters."}
                onChange={(v) => { setPassword(v); setPasswordIssue(undefined) }}
              />
              {error ? (
                <p role="alert" className="text-[13px] leading-[1.45] text-error">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="flex h-10 w-full items-center justify-center rounded-md bg-indigo text-[13px] font-medium text-white hover:bg-indigo-deep disabled:cursor-progress disabled:opacity-70"
              >
                {submitting ? "Creating account…" : "Create free account"}
              </button>
            </form>
            <p className="text-center text-[12px] text-muted">
              Your courses and calendar will be preserved on your new account.
            </p>
          </div>
        ) : (
          <div className="panel flex flex-col items-center gap-5 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-indigo-soft text-indigo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-[20px] font-medium tracking-[-0.02em] text-ink">Check your email</h1>
              <p className="text-[13px] leading-5 text-muted">
                We sent a verification code to <strong className="font-medium text-ink">{upgradedEmail}</strong>.
                Verify your email to finish creating your account.
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="text-[13px] font-medium text-indigo hover:text-indigo-deep focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              Go to sign in →
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}
