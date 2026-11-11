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
  onChange: (value: string) => void
}

const controlClass =
  "h-12 w-full min-w-0 rounded-[10px] border border-[var(--auth-line)] bg-[var(--auth-surface)] px-3.5 text-[14px] leading-6 text-[var(--auth-ink)] outline-none placeholder:text-[var(--auth-faint)] focus:border-[var(--auth-indigo)]"

export function AuthField({
  id,
  label,
  value,
  placeholder,
  type = "text",
  autoComplete = "off",
  onChange,
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false)
  const password = type === "password"
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] leading-5 font-medium">
        {label}
      </label>
      {password ? (
        <div className="flex h-12 w-full min-w-0 items-center gap-3 rounded-[10px] border border-[var(--auth-line)] bg-[var(--auth-surface)] px-3.5 focus-within:border-[var(--auth-indigo)]">
          <input
            id={id}
            name={id}
            type={visible ? "text" : "password"}
            value={value}
            placeholder={placeholder}
            autoComplete={autoComplete}
            onChange={(event) => onChange(event.target.value)}
            className="w-full min-w-0 flex-1 bg-transparent text-[14px] leading-6 text-[var(--auth-ink)] outline-none placeholder:text-[var(--auth-faint)]"
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
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
        />
      )}
    </div>
  )
}
