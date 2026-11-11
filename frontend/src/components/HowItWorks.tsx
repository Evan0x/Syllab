const steps = [
  {
    number: "01",
    title: "Upload your syllabus",
    desktop: "Start with the PDF your professor shared. One course at a time.",
    mobile: "Start with your professor’s PDF.",
  },
  {
    number: "02",
    title: "Review the dates",
    desktop: "We find classes, deadlines, and exams. You check anything that looks uncertain.",
    mobile: "We find classes, deadlines, and exams. You review them.",
  },
  {
    number: "03",
    title: "Keep the semester close",
    desktop: "Save it here, export a .ics file, or ask the advisor about what’s coming.",
    mobile: "Save it, export a .ics file, or plan from here.",
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="px-5 pt-2 pb-12 lg:mx-auto lg:w-full lg:max-w-[960px] lg:border-t lg:border-hairline lg:px-0 lg:pt-8 lg:pb-14"
    >
      <h2 className="text-[13px] font-medium text-ink">How it works</h2>
      <ol className="mt-5 grid grid-cols-1 gap-6 lg:mt-6 lg:grid-cols-3 lg:gap-8">
        {steps.map((step) => (
          <li key={step.number} className="flex gap-3 lg:block">
            <p className="text-[12px] font-medium tabular-nums text-muted lg:mb-2">{step.number}</p>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-[13px] font-medium text-ink">{step.title}</h3>
              <p className="text-[13px] leading-5 text-muted">
                <span className="lg:hidden">{step.mobile}</span>
                <span className="hidden lg:inline">{step.desktop}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
