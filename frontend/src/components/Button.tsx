import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

type ButtonProps = {
  children: ReactNode
  icon?: LucideIcon
  type?: "submit" | "button"
  disabled?: boolean
  spinIcon?: boolean
  variant?: "primary" | "secondary" | "ghost" | "danger"
  onClick?: () => void
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-indigo text-white hover:bg-indigo-deep active:bg-indigo-deep active:scale-[0.98]",
  secondary: "border border-hairline bg-surface text-ink hover:bg-well active:bg-well active:scale-[0.98]",
  ghost: "bg-transparent text-indigo hover:bg-indigo-soft active:bg-indigo-soft",
  danger: "bg-error text-white hover:opacity-90 active:opacity-90 active:scale-[0.98]",
}

export function Button({
  icon: Icon,
  children,
  type = "button",
  disabled = false,
  spinIcon = false,
  variant = "primary",
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
        disabled ? "cursor-not-allowed border-transparent bg-disabled text-disabled-ink" : variants[variant]
      }`}
    >
      {Icon ? (
        <Icon size={15} strokeWidth={1.75} className={spinIcon ? "animate-spin" : undefined} aria-hidden />
      ) : null}
      {children}
    </button>
  )
}
