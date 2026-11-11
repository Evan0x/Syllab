import type { ReactNode } from "react"

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col items-start gap-2">
      <p className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{eyebrow}</p>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] leading-7 font-medium tracking-[-0.02em] text-ink lg:text-[24px] lg:leading-8">
          {title}
        </h1>
        {description ? <p className="max-w-[560px] text-[13px] leading-5 text-muted">{description}</p> : null}
      </div>
      {children}
    </header>
  )
}
