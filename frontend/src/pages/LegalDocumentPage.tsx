import { ArrowLeft } from "lucide-react"
import type { LegalDocument } from "../content/legal.ts"
import { SiteFooter } from "../components/SiteFooter.tsx"
import { BrandLockup } from "../components/login/BrandLockup.tsx"
import { usePageTitle } from "../lib/pageTitle.ts"

type LegalDocumentPageProps = {
  document: LegalDocument
}

export function LegalDocumentPage({ document }: LegalDocumentPageProps) {
  usePageTitle(`${document.title} · Syllapin`)
  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header flex h-14 items-center justify-between gap-4 border-b border-hairline px-5 lg:px-8 xl:px-12">
        <a
          href="/"
          className="flex min-w-0 items-center gap-[9px] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        >
          <BrandLockup />
        </a>
        <a
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-[13px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
          Back to sign in
        </a>
      </header>
      <main id="main" className="mx-auto w-full max-w-[720px] px-6 py-12 lg:py-16">
        <h1 className="text-[24px] leading-8 font-medium tracking-[-0.03em] text-ink lg:text-[28px]">{document.title}</h1>
        <p className="mt-5 text-[14px] leading-[1.65] text-muted">{document.summary}</p>
        {document.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">{section.heading}</h2>
            <div className="mt-3 flex flex-col gap-3">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-[14px] leading-[1.65] text-ink">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.review ? (
              <p className="mt-4 rounded-md border border-hairline bg-well px-4 py-3 text-[13px] leading-5 text-ink">
                <span className="font-medium">Needs review. </span>
                {section.review}
              </p>
            ) : null}
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  )
}
