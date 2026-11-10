import { ArrowUpRight, CalendarCheck2 } from "lucide-react"

type SiteHeaderProps = {
  onHome?: () => void
  email?: string
  onLogout?: () => void
}

export function SiteHeader({ onHome, email, onLogout }: SiteHeaderProps) {
  const logoClass =
    "flex items-center gap-[9px] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
  const logo = (
    <>
      <span className="flex size-[29px] items-center justify-center rounded-[7px] bg-indigo text-white">
        <CalendarCheck2 size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="text-[20px] tracking-[-0.7px] text-ink">Syllapin</span>
    </>
  )

  return (
    <header className="flex h-[76px] items-center justify-between border-b border-hairline px-6 lg:h-[88px] lg:px-10 xl:px-20">
      {onHome ? (
        <button type="button" onClick={onHome} className={`${logoClass} cursor-pointer border-0 bg-transparent p-0 text-left`}>
          {logo}
        </button>
      ) : (
        <a href="#top" className={logoClass}>
          {logo}
        </a>
      )}
      <nav aria-label="Page" className="flex items-center gap-8 text-[13px] text-muted">
        <a href="#how-it-works" className="hidden rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:inline">
          How it works
        </a>
        <a href="#privacy" className="hidden rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:inline">
          Privacy
        </a>
        {email ? (
          <div className="flex items-center gap-4">
            <p className="hidden text-[12px] text-ink lg:block">{email}</p>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-sm text-[13px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
              >
                Log out
              </button>
            ) : null}
          </div>
        ) : null}
        <a href="#help" className="inline-flex items-center gap-1 rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:hidden">
          Get help
          <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </a>
      </nav>
    </header>
  )
}
