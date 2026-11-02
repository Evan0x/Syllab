import { ArrowUpRight, CalendarCheck2 } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="flex h-[76px] items-center justify-between border-b border-hairline px-6 lg:h-[88px] lg:px-10 xl:px-20">
      <a href="#top" className="flex items-center gap-[9px] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo">
        <span className="flex size-[29px] items-center justify-center rounded-[7px] bg-indigo text-white">
          <CalendarCheck2 size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="text-[20px] tracking-[-0.7px] text-ink">SyllaCal</span>
      </a>
      <nav aria-label="Page" className="flex items-center gap-8 text-[13px] text-muted">
        <a href="#how-it-works" className="hidden rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:inline">
          How it works
        </a>
        <a href="#privacy" className="hidden rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:inline">
          Privacy
        </a>
        <p className="hidden items-center gap-[7px] text-[12px] text-ink lg:flex">
          <span className="size-[5px] rounded-full bg-ink" aria-hidden />
          No account needed
        </p>
        <a href="#help" className="inline-flex items-center gap-1 rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:hidden">
          Get help
          <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </a>
      </nav>
    </header>
  )
}
