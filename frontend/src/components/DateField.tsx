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
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className={`control flex items-center pr-2.5 ${invalid ? "border-error" : ""}`}>
        <input
          id={id}
          name={id}
          type="date"
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`date-input h-full min-w-0 flex-1 border-0 bg-transparent pr-1 text-[13px] outline-none ${
            value ? "text-ink" : "text-placeholder"
          }`}
        />
        <CalendarDays size={15} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
      </div>
    </div>
  )
}
