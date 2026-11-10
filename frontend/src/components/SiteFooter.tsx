export function SiteFooter() {
  return (
    <footer className="border-t border-hairline px-6 py-6 text-[11px] text-muted lg:flex lg:items-center lg:justify-between lg:px-10 lg:py-[25px] xl:px-20">
      <p id="help" className="leading-[1.6] lg:order-2 lg:leading-normal">
        A little peace of mind. Always double-check dates against your syllabus.
      </p>
      <div className="mt-5 flex items-center justify-between lg:contents">
        <p className="lg:order-1">© 2026 Syllapin</p>
        <p className="whitespace-pre lg:order-3">
          <a href="#privacy" className="hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo">
            Privacy
          </a>
          {"   ·   "}
          <a href="#help" className="hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo">
            Get help
          </a>
        </p>
      </div>
    </footer>
  )
}
