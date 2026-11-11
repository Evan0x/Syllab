import { CalendarDays } from "lucide-react"

type DateFieldProps = {
  id: string
  label: string
  value: string
  invalid?: boolean
  onChange: (value: string) => void
}

export function DateField({ id, label, value, invalid = false, onChange }: DateFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-[13px] text-ink">
        {label}
      </label>
      <div
        className={`flex h-12 items-center rounded-lg border bg-surface pr-2.5 focus-within:border-indigo lg:pr-[13px] ${
          invalid ? "border-error" : "border-hairline"
        }`}
      >
        <input
          id={id}
          name={id}
          type="date"
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`date-input h-full min-w-0 flex-1 border-0 bg-transparent pr-1 pl-2.5 text-base outline-none lg:pl-[13px] lg:text-[12px] ${
            value ? "text-ink" : "text-placeholder"
          }`}
        />
        <CalendarDays size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
      </div>
    </div>
  )
}
