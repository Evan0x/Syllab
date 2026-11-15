import { useEffect, useRef, useState } from "react"
import { BrandLockup } from "./login/BrandLockup.tsx"

type SiteHeaderProps = {
  onHome?: () => void
  email?: string
  onLogout?: () => void
  logoHref?: string
  reviewing?: boolean
}

const productNav = [
  { href: "/", label: "Calendar", match: ["/"] },
  { href: "/workload", label: "Workload", match: ["/workload"] },
  { href: "/advisor", label: "Advisor", match: ["/advisor"] },
] as const

export function SiteHeader({ onHome, email, onLogout, logoHref = "/", reviewing = false }: SiteHeaderProps) {
  const logoClass =
    "flex items-center gap-[9px] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  const addingCourse = path === "/upload" || reviewing

  return (
    <header className="site-header border-b border-hairline">
      <div className="flex h-[83px] items-center justify-between gap-x-4 px-5 lg:px-8 xl:px-12">
        {onHome ? (
          <button type="button" onClick={onHome} className={`${logoClass} cursor-pointer border-0 bg-transparent p-0 text-left`}>
            <BrandLockup />
          </button>
        ) : (
          <a href={logoHref} className={logoClass}>
            <BrandLockup />
          </a>
        )}
        {email ? (
          <div className="flex min-w-0 items-center gap-4">
            {/* Desktop/tablet nav: all links + Add course button */}
            <nav aria-label="Primary" className="hidden items-center gap-6 text-[13px] sm:flex">
              <DesktopNavLinks path={path} addingCourse={addingCourse} />
            </nav>
            {/* Mobile: show Add course button in main bar when not already there */}
            {!addingCourse ? (
              <a
                href="/upload"
                className="inline-flex shrink-0 items-center rounded-md border border-hairline bg-surface px-4 py-2.5 text-[13px] font-medium text-ink hover:border-indigo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo sm:hidden"
              >
                + Add course
              </a>
            ) : null}
            {onLogout ? <AccountMenu email={email} onLogout={onLogout} /> : null}
          </div>
        ) : null}
      </div>
      {/* Mobile nav row: Calendar / Workload / Advisor (+ Add course when active) */}
      {email ? (
        <nav aria-label="Primary" className="flex gap-0.5 overflow-x-auto border-t border-hairline px-3 py-1.5 text-[13px] sm:hidden">
          <MobileNavLinks path={path} addingCourse={addingCourse} />
        </nav>
      ) : null}
    </header>
  )
}

function DesktopNavLinks({ path, addingCourse }: { path: string; addingCourse: boolean }) {
  return (
    <>
      {productNav.map((item) => {
        const current = !addingCourse && item.match.some((match) =>
          match === "/" ? path === "/" || path === "/calendar" : path === match
        )
        return (
          <a key={item.href} href={item.href} aria-current={current ? "page" : undefined}
             className={desktopNavClass(current)}>
            {item.label}
          </a>
        )
      })}
      {addingCourse ? (
        <span className={desktopNavClass(true)} aria-current="page">Add course</span>
      ) : (
        <a
          href="/upload"
          className="inline-flex shrink-0 items-center rounded-md border border-hairline bg-surface px-4 py-2.5 font-medium text-ink hover:border-indigo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        >
          + Add course
        </a>
      )}
    </>
  )
}

function MobileNavLinks({ path, addingCourse }: { path: string; addingCourse: boolean }) {
  return (
    <>
      {productNav.map((item) => {
        const current = !addingCourse && item.match.some((match) =>
          match === "/" ? path === "/" || path === "/calendar" : path === match
        )
        return (
          <a key={item.href} href={item.href} aria-current={current ? "page" : undefined}
             className={mobileNavClass(current)}>
            {item.label}
          </a>
        )
      })}
      {addingCourse ? (
        <a href="/upload" aria-current="page" className={mobileNavClass(true)}>
          Add course
        </a>
      ) : null}
    </>
  )
}

function desktopNavClass(current: boolean) {
  return `shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
    current
      ? "bg-indigo-soft px-3 py-2 font-semibold text-indigo"
      : "py-2 font-medium text-muted hover:text-ink"
  }`
}

function mobileNavClass(current: boolean) {
  return `shrink-0 rounded-md px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
    current ? "bg-indigo-soft font-semibold text-indigo" : "text-muted hover:text-ink"
  }`
}

function AccountMenu({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const initial = email.trim().charAt(0).toUpperCase() || "U"

  useEffect(() => {
    if (!open) {
      return
    }
    firstItemRef.current?.focus()
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="flex size-8 items-center justify-center rounded-full bg-well text-[12px] font-medium text-ink hover:bg-indigo-soft hover:text-indigo active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
      >
        <span className="sr-only">Account menu for {email}</span>
        <span aria-hidden>{initial}</span>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-hairline bg-surface p-1.5 shadow-float"
        >
          <p className="break-all px-3 py-2 text-[12px] leading-5 text-muted">{email}</p>
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}
