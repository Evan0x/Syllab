import { ArrowRight, LockKeyhole } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { AuthError, loginAccount, registerAccount, verifyEmail, type Account } from "../api/auth.ts"
import { csrfToken } from "../api/http.ts"
import { AuthField } from "../components/login/AuthField.tsx"
import { BrandLockup } from "../components/login/BrandLockup.tsx"
import { SemesterPreview } from "../components/login/SemesterPreview.tsx"

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
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | undefined>(() =>
    new URLSearchParams(window.location.search).get("oauthError") === "email" ? OAUTH_EMAIL_ERROR : undefined,
  )
  const [submitting, setSubmitting] = useState(false)

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
  }

  const heading = mode === "login" ? "Welcome back" : mode === "register" ? "Create an account" : "Enter your code"
  const description =
    mode === "login"
      ? "Sign in to your Syllapin account."
      : mode === "register"
        ? "Your password must be at least 10 characters. We'll email you a verification code."
        : `Enter the code sent to ${email}. It expires in 15 minutes.`
  const label = submitting
    ? "Please wait"
    : mode === "login"
      ? "Sign in"
      : mode === "register"
        ? "Create account"
        : "Verify email"

  return (
    <div className="auth-screen flex min-h-screen flex-col min-[1100px]:flex-row">
      <aside className="hidden min-h-screen w-[640px] shrink-0 flex-col justify-between bg-[var(--auth-panel)] px-14 pt-12 pb-10 min-[1100px]:flex">
        <BrandLockup size="large" />
        <SemesterPreview />
        <p className="text-[10px] leading-4 font-medium tracking-[0.4px] text-[var(--auth-muted)]">
          LESS ORGANIZING. MORE LEARNING.
        </p>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col px-6 pt-10 pb-7 min-[1100px]:px-16 min-[1100px]:pt-12 min-[1100px]:pb-10">
        <p className="hidden text-right text-[12px] leading-5 text-[var(--auth-faint)] min-[1100px]:block">
          Your next chapter starts here.
        </p>
        <div className="min-[1100px]:hidden">
          <BrandLockup size="large" />
        </div>
        <div className="flex flex-1 items-center py-8">
          <div className="mx-auto flex w-full max-w-[400px] flex-col gap-7">
            <div className="flex flex-col gap-2.5">
              <h1 className="text-[32px] leading-10 font-semibold tracking-[-1px]">{heading}</h1>
              <p className="text-[14px] leading-[22px] text-[var(--auth-muted)]">{description}</p>
            </div>
            {mode === "login" ? (
              <div className="flex flex-col gap-3">
                <a
                  href="/oauth2/authorization/google"
                  className="flex h-12 items-center justify-center rounded-[10px] border border-[var(--auth-line)] bg-[var(--auth-surface)] text-[14px] text-[var(--auth-ink)] hover:border-[var(--auth-indigo)]"
                >
                  Continue with Google
                </a>
                <a
                  href="/oauth2/authorization/github"
                  className="flex h-12 items-center justify-center rounded-[10px] border border-[var(--auth-line)] bg-[var(--auth-surface)] text-[14px] text-[var(--auth-ink)] hover:border-[var(--auth-indigo)]"
                >
                  Continue with GitHub
                </a>
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
              {mode === "verify" ? (
                <AuthField
                  id="verification-code"
                  label="Verification code"
                  value={code}
                  placeholder="Verification code"
                  autoComplete="one-time-code"
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
                    onChange={setEmail}
                  />
                  <AuthField
                    id="password"
                    label="Password"
                    type="password"
                    value={password}
                    placeholder={mode === "login" ? "Enter your password" : "At least 10 characters"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    onChange={setPassword}
                  />
                </>
              )}
              {mode === "login" ? (
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[13px] leading-5 text-[var(--auth-muted)]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="size-4 rounded-[4px] border border-[var(--auth-check)] accent-[var(--auth-indigo)]"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="text-[13px] leading-5 font-medium text-[var(--auth-indigo)]"
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="text-[13px] leading-[1.45] text-[var(--auth-error)]">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--auth-indigo)] px-5 text-[14px] leading-[22px] font-semibold text-white hover:bg-[var(--auth-indigo-deep)] disabled:cursor-progress disabled:opacity-70"
              >
                {label}
                {mode === "login" && !submitting ? <ArrowRight size={18} strokeWidth={1.75} aria-hidden /> : null}
              </button>
            </form>
            {mode === "login" ? (
              <p className="text-center text-[13px] leading-5 text-[var(--auth-muted)]">
                New to Syllapin?{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--auth-indigo)]"
                  onClick={() => {
                    setMode("register")
                    setError(undefined)
                  }}
                >
                  Create Account
                </button>
              </p>
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
              <LockKeyhole size={14} strokeWidth={1.75} aria-hidden />
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
