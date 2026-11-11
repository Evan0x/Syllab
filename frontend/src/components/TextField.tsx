type TextFieldProps = {
  id: string
  label: string
  value: string
  placeholder: string
  type?: "text" | "password"
  autoComplete?: string
  error?: string
  onChange: (value: string) => void
}

export function TextField({
  id,
  label,
  value,
  placeholder,
  type = "text",
  autoComplete = "off",
  error,
  onChange,
}: TextFieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`h-12 w-full rounded-lg border bg-surface px-[13px] text-[14px] text-ink outline-none placeholder:text-placeholder focus:border-indigo ${
          error ? "border-error" : "border-hairline"
        }`}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-[12px] leading-[1.45] text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
