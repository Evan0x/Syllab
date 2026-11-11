import { ArrowUpRight } from "lucide-react"
import { BrandLockup } from "./login/BrandLockup.tsx"

type SiteHeaderProps = {
  onHome?: () => void
  email?: string
  onLogout?: () => void
  logoHref?: string
  sectionLinks?: boolean
}

export function SiteHeader({ onHome, email, onLogout, logoHref = "/", sectionLinks = false }: SiteHeaderProps) {
  const logoClass =
    "flex items-center gap-[9px] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
  const logo = <BrandLockup />
  const path = window.location.pathname.replace(/\/+$/, "") || "/"

  return (
    <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-6 py-3 lg:h-[88px] lg:flex-nowrap lg:px-10 lg:py-0 xl:px-20">
      {onHome ? (
        <button type="button" onClick={onHome} className={`${logoClass} cursor-pointer border-0 bg-transparent p-0 text-left`}>
          {logo}
        </button>
      ) : (
        <a href={logoHref} className={logoClass}>
          {logo}
        </a>
      )}
      <nav aria-label="Page" className="flex items-center gap-3 text-[13px] text-muted sm:gap-4 lg:gap-8">
        {sectionLinks ? (
          <>
            <a href="#how-it-works" className="hidden rounded-sm whitespace-nowrap hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:inline">
              How it works
            </a>
            <a href="#privacy" className="hidden rounded-sm whitespace-nowrap hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:inline">
              Privacy
            </a>
          </>
        ) : null}
        {email ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="/calendar"
              aria-current={path === "/calendar" ? "page" : undefined}
              className="rounded-sm whitespace-nowrap text-ink hover:text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              Calendar
            </a>
            <a
              href="/workload"
              aria-current={path === "/workload" ? "page" : undefined}
              className="rounded-sm whitespace-nowrap text-ink hover:text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              Workload
            </a>
            <p className="hidden max-w-40 truncate text-[12px] text-ink xl:block">{email}</p>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-sm whitespace-nowrap text-[13px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
              >
                Log out
              </button>
            ) : null}
          </div>
        ) : null}
        {email ? null : (
          <a href="#help" className="inline-flex items-center gap-1 rounded-sm whitespace-nowrap hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo lg:hidden">
            Get help
            <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
          </a>
        )}
      </nav>
    </header>
  )
}

