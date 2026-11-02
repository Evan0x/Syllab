import type { LucideIcon } from "lucide-react"

type ButtonProps = {
  icon: LucideIcon
  children: string
  type?: "submit" | "button"
  disabled?: boolean
  spinIcon?: boolean
  onClick?: () => void
}

export function Button({
  icon: Icon,
  children,
  type = "button",
  disabled = false,
  spinIcon = false,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-12 w-full items-center justify-center gap-[9px] rounded-lg px-[18px] text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
        disabled
          ? "cursor-progress bg-disabled text-disabled-ink"
          : "bg-indigo text-white hover:bg-indigo-deep"
      }`}
    >
      <Icon
        size={17}
        strokeWidth={1.75}
        className={spinIcon ? "animate-spin" : undefined}
        aria-hidden
      />
      {children}
    </button>
  )
}
