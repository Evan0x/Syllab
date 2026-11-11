import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  tone = "empty",
}: {
  icon: LucideIcon
  title: string
  message: string
  action?: ReactNode
  tone?: "empty" | "error" | "loading"
}) {
  const iconWrap =
    tone === "error" ? "bg-error-soft text-error" : tone === "loading" ? "bg-indigo-soft text-indigo" : "bg-well text-muted"

  return (
    <div
      className="panel flex flex-col items-start gap-4 px-5 py-8"
      role={tone === "error" ? "alert" : tone === "loading" ? "status" : undefined}
    >
      <span className={`flex size-9 items-center justify-center rounded-md ${iconWrap}`}>
        <Icon size={18} strokeWidth={1.75} aria-hidden className={tone === "loading" ? "animate-spin" : undefined} />
      </span>
      <div className="flex max-w-[480px] flex-col gap-1.5">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
        <p className="text-[13px] leading-5 text-muted">{message}</p>
      </div>
      {action}
    </div>
  )
}
