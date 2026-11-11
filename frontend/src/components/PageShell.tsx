import type { ReactNode } from "react"
import { SiteFooter } from "./SiteFooter.tsx"
import { SiteHeader } from "./SiteHeader.tsx"

export function PageShell({
  email,
  onLogout,
  onHome,
  logoHref,
  reviewing = false,
  contained = true,
  children,
}: {
  email: string
  onLogout: () => void
  onHome?: () => void
  logoHref?: string
  reviewing?: boolean
  contained?: boolean
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader email={email} onLogout={onLogout} onHome={onHome} logoHref={logoHref} reviewing={reviewing} />
      <main id="main" className={contained ? "px-5 pt-8 pb-16 lg:px-8 lg:pt-10 xl:px-12" : undefined}>
        {contained ? <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">{children}</div> : children}
      </main>
      <SiteFooter />
    </div>
  )
}
