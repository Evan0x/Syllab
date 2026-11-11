const linkClass =
  "rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline px-5 py-5 text-[12px] text-muted lg:flex lg:items-center lg:justify-between lg:px-8 lg:py-5 xl:px-12">
      <p className="leading-[1.6] lg:order-2 lg:leading-normal">
        Always double-check dates against your syllabus.
      </p>
      <div className="mt-5 flex items-center justify-between gap-6 lg:contents">
        <p className="lg:order-1">© 2026 Syllapin</p>
        <p className="flex flex-wrap justify-end gap-x-4 gap-y-1 lg:order-3">
          <a href="/terms" className={linkClass}>
            Terms
          </a>
          <a href="/privacy" className={linkClass}>
            Privacy
          </a>
        </p>
      </div>
    </footer>
  )
}
