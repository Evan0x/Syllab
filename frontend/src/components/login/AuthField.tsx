import { EyeOff } from "lucide-react"
import { useState } from "react"
import eye from "../../assets/login/eye.svg"

type AuthFieldProps = {
  id: string
  label: string
  value: string
  placeholder: string
  type?: "text" | "password" | "email"
  autoComplete?: string
  autoFocus?: boolean
  error?: string
  hint?: string
  spellCheck?: boolean
  onChange: (value: string) => void
}

const controlClass =
  "h-10 w-full min-w-0 rounded-md border border-[var(--auth-line)] bg-[var(--auth-surface)] px-3 text-[13px] leading-5 text-[var(--auth-ink)] outline-none placeholder:text-[var(--auth-faint)] focus:border-[var(--auth-indigo)]"

export function AuthField({
  id,
  label,
  value,
  placeholder,
  type = "text",
  autoComplete = "off",
  autoFocus = false,
  error,
  hint,
  spellCheck,
  onChange,
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false)
  const password = type === "password"
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined
  const fieldClass = error
    ? "border-[var(--auth-error)] focus-within:border-[var(--auth-error)]"
    : "border-[var(--auth-line)] focus-within:border-[var(--auth-indigo)]"
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] leading-5 font-medium">
        {label}
      </label>
      {password ? (
        <div className={`flex h-10 w-full min-w-0 items-center gap-3 rounded-md border bg-[var(--auth-surface)] px-3 ${fieldClass}`}>
          <input
            id={id}
            name={id}
            type={visible ? "text" : "password"}
            value={value}
            placeholder={placeholder}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
            className="w-full min-w-0 flex-1 bg-transparent text-[13px] leading-5 text-[var(--auth-ink)] outline-none placeholder:text-[var(--auth-faint)]"
          />
          <button
            type="button"
            className="text-[var(--auth-faint)] hover:text-[var(--auth-ink)]"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? (
              <EyeOff size={20} strokeWidth={1.7} aria-hidden />
            ) : (
              <img src={eye} alt="" width="20" height="20" />
            )}
          </button>
        </div>
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          spellCheck={spellCheck}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`${controlClass} ${error ? "border-[var(--auth-error)]" : ""}`}
        />
      )}
      {hint ? (
        <p id={hintId} className="text-[12px] leading-[18px] text-[var(--auth-faint)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[12px] leading-[18px] text-[var(--auth-error)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
