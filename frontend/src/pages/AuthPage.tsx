import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { AuthError, loginAccount, registerAccount, verifyEmail, type Account } from "../api/auth.ts"
import { csrfToken } from "../api/http.ts"
import arrow from "../assets/login/arrow.svg"
import lock from "../assets/login/lock.svg"
import { AuthField } from "../components/login/AuthField.tsx"
import { BrandLockup } from "../components/login/BrandLockup.tsx"
import { SemesterPreview } from "../components/login/SemesterPreview.tsx"
import { usePageTitle } from "../lib/pageTitle.ts"

type AuthPageProps = {
  onAuthenticated: (account: Account) => void
}

type Mode = "login" | "register" | "verify"

const MISSING_CODE = "Enter the verification code."
const OAUTH_EMAIL_ERROR = "That provider did not confirm a verified email."

const footerLink =
  "rounded-sm font-medium text-[var(--auth-muted)] hover:text-[var(--auth-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-indigo)]"

export function verificationCodeError(code: string): string | undefined {
  if (code.trim().length === 0) {
    return MISSING_CODE
  }
  return undefined
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [emailIssue, setEmailIssue] = useState<string>()
  const [passwordIssue, setPasswordIssue] = useState<string>()
  const [error, setError] = useState<string | undefined>(() =>
    new URLSearchParams(window.location.search).get("oauthError") === "email" ? OAUTH_EMAIL_ERROR : undefined,
  )
  const [submitting, setSubmitting] = useState(false)

  usePageTitle(mode === "login" ? "Sign in · Syllapin" : mode === "register" ? "Create account · Syllapin" : "Verify email · Syllapin")

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!csrfToken()) {
      setError("Could not start a secure session. Refresh the page and try again.")
      return
    }
    if (mode === "verify") {
      const codeError = verificationCodeError(code)
      if (codeError) {
        setError(codeError)
        document.getElementById("verification-code")?.focus()
        return
      }
    } else {
      const nextEmail = emailFieldError(email)
      const nextPassword = passwordFieldError(password, mode)
      setEmailIssue(nextEmail)
      setPasswordIssue(nextPassword)
      if (nextEmail || nextPassword) {
        document.getElementById(nextEmail ? "email" : "password")?.focus()
        return
      }
    }
    setSubmitting(true)
    setError(undefined)
    let emailVerified = false
    try {
      if (mode === "register") {
        await registerAccount({ email, password })
        setCode("")
        setMode("verify")
        return
      }
      if (mode === "verify") {
        await verifyEmail({ email, code: code.trim() })
        emailVerified = true
      }
      onAuthenticated(await loginAccount({ email, password }))
    } catch (caught) {
      if (mode === "verify" && emailVerified) {
        setMode("login")
      }
      const fallback =
        mode === "register"
          ? "Could not create an account"
          : mode === "verify" && !emailVerified
            ? "That code is not valid."
            : "Could not sign in"
      setError(caught instanceof AuthError ? caught.message : fallback)
    } finally {
      setSubmitting(false)
    }
  }

  function showLogin() {
    setMode("login")
    setCode("")
    setError(undefined)
    setEmailIssue(undefined)
    setPasswordIssue(undefined)
  }

  const heading = mode === "login" ? "Welcome back" : mode === "register" ? "Create an account" : "Check your email"
  const description =
    mode === "login"
      ? "Sign in to turn syllabi into a calendar you can actually use."
      : mode === "register"
        ? "Use your school email if you have one. We’ll send a verification code."
        : `Enter the code sent to ${email}. It expires in 15 minutes.`
  const label = submitting
    ? "Please wait"
    : mode === "login"
      ? "Sign in"
      : mode === "register"
        ? "Create account"
        : "Verify email"

  return (
    <div className="auth-screen flex min-h-screen w-full max-w-full flex-col overflow-x-clip min-[1100px]:flex-row">
      <a href="#auth-form" className="skip-link">
        Skip to sign in
      </a>
      <aside className="hidden min-h-screen shrink-0 flex-col justify-between bg-[var(--auth-panel)] px-14 pt-12 pb-10 min-[1100px]:flex min-[1100px]:w-[640px]">
        <BrandLockup size="mark" />
        <SemesterPreview />
        <p className="text-[10px] leading-4 font-medium tracking-[1.2px] text-[var(--auth-muted)]">
          LESS ORGANIZING. MORE LEARNING.
        </p>
      </aside>
      <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col gap-8 px-6 pt-10 pb-7 min-[1100px]:px-16 min-[1100px]:pt-12 min-[1100px]:pb-10">
        <p className="hidden text-right text-[12px] leading-5 text-[var(--auth-faint)] min-[1100px]:block">
          Your next chapter starts here.
        </p>
        <div className="min-[1100px]:hidden">
          <BrandLockup size="mark" />
        </div>
        <div className="flex flex-1 items-center">
          <div className="mx-auto flex w-full min-w-0 max-w-[400px] flex-col gap-7">
            <div className="flex flex-col gap-2.5">
              <h1 className="text-[24px] leading-8 font-medium tracking-[-0.03em]">{heading}</h1>
              <p className="text-[13px] leading-5 text-[var(--auth-muted)]">{description}</p>
            </div>
            <form id="auth-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
              {mode === "verify" ? (
                <AuthField
                  id="verification-code"
                  label="Verification code"
                  value={code}
                  placeholder="Paste the code from your email"
                  autoComplete="one-time-code"
                  autoFocus
                  spellCheck={false}
                  onChange={setCode}
                />
              ) : (
                <>
                  <AuthField
                    id="email"
                    label="Email address"
                    type="email"
                    value={email}
                    placeholder="you@university.edu"
                    autoComplete="email"
                    error={emailIssue}
                    onChange={(value) => {
                      setEmail(value)
                      setEmailIssue(undefined)
                    }}
                  />
                  <AuthField
                    id="password"
                    label="Password"
                    type="password"
                    value={password}
                    placeholder={mode === "login" ? "Enter your password" : "At least 10 characters"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    error={passwordIssue}
                    hint={
                      mode === "register"
                        ? password.length >= 10
                          ? "Strong enough to continue."
                          : "Use at least 10 characters."
                        : undefined
                    }
                    onChange={(value) => {
                      setPassword(value)
                      setPasswordIssue(undefined)
                    }}
                  />
                </>
              )}
              {error ? (
                <p role="alert" className="text-[13px] leading-[1.45] text-[var(--auth-error)]">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--auth-indigo)] px-4 text-[13px] font-medium text-white hover:bg-[var(--auth-indigo-deep)] disabled:cursor-progress disabled:opacity-70"
              >
                {label}
                {mode === "login" && !submitting ? <img src={arrow} alt="" width="18" height="18" /> : null}
              </button>
            </form>
            {mode === "login" ? (
              <>
                <div className="flex items-center gap-3 text-[12px] text-[var(--auth-faint)]">
                  <span className="h-px flex-1 bg-[var(--auth-line)]" />
                  or continue with
                  <span className="h-px flex-1 bg-[var(--auth-line)]" />
                </div>
                <div className="flex flex-col gap-3">
                  <OauthLink href="/oauth2/authorization/google" label="Continue with Google">
                    <GoogleMark />
                  </OauthLink>
                  <OauthLink href="/oauth2/authorization/github" label="Continue with GitHub">
                    <GitHubMark />
                  </OauthLink>
                </div>
                <p className="text-center text-[13px] leading-5 text-[var(--auth-muted)]">
                  New to Syllapin?{" "}
                  <button
                    type="button"
                    className="font-semibold text-[var(--auth-indigo)]"
                    onClick={() => {
                      setMode("register")
                      setError(undefined)
                      setEmailIssue(undefined)
                      setPasswordIssue(undefined)
                    }}
                  >
                    Create an account
                  </button>
                </p>
              </>
            ) : (
              <button
                type="button"
                className="self-center text-[13px] leading-5 text-[var(--auth-muted)] hover:text-[var(--auth-ink)]"
                onClick={showLogin}
              >
                Already have an account? Sign in
              </button>
            )}
            <p className="flex items-center justify-center gap-1.5 text-[12px] leading-[18px] text-[var(--auth-faint)]">
              <img src={lock} alt="" width="14" height="14" />
              Your plans stay yours.
            </p>
          </div>
        </div>
        <footer className="flex flex-col items-center gap-2.5 text-[12px] leading-5 min-[1100px]:flex-row min-[1100px]:justify-between">
          <p className="order-2 text-[11px] leading-[18px] text-[var(--auth-faint)] min-[1100px]:order-1">© 2026 Syllapin</p>
          <p className="order-1 flex gap-6 font-medium min-[1100px]:order-2 min-[1100px]:gap-5 min-[1100px]:text-[11px]">
            <a href="/terms" className={footerLink}>
              Terms
            </a>
            <a href="/privacy" className={footerLink}>
              Privacy
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

function emailFieldError(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) {
    return "Enter your email address."
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address."
  }
  return undefined
}

function passwordFieldError(value: string, mode: Mode): string | undefined {
  if (!value) {
    return "Enter your password."
  }
  if (mode === "register" && value.length < 10) {
    return "Password must be at least 10 characters."
  }
  return undefined
}

function OauthLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="flex h-10 items-center justify-center gap-2.5 rounded-md border border-[var(--auth-line)] bg-[var(--auth-surface)] text-[13px] text-[var(--auth-ink)] hover:border-[var(--auth-indigo)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-indigo)]"
    >
      {children}
      {label}
    </a>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.59.1-1.17.26-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96L3.97 7.3C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden className="fill-current">
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.23 1.89.87 2.35.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.7 7.7 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
    </svg>
  )
}
