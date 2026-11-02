const steps = [
  {
    number: "01",
    title: "Upload your syllabus",
    desktop: "Start with the PDF your professor shared.",
    mobile: "Start with your professor’s PDF.",
  },
  {
    number: "02",
    title: "Let the dates come together",
    desktop: "We find classes, deadlines and exam dates.",
    mobile: "We find classes, deadlines and exams.",
  },
  {
    number: "03",
    title: "Make the semester yours",
    desktop: "Download your .ics file and import it.",
    mobile: "Download your .ics file and import it.",
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="px-6 pt-3 pb-[30px] lg:mx-auto lg:w-full lg:max-w-[960px] lg:border-t lg:border-hairline lg:px-0 lg:pt-7 lg:pb-10"
    >
      <h2 className="text-[12px] font-semibold text-ink lg:hidden">A semester, sorted in three steps.</h2>
      <ol className="mt-[22px] flex flex-col gap-[22px] lg:mt-0 lg:flex-row lg:gap-10">
        {steps.map((step) => (
          <li key={step.number} className="flex gap-4 lg:block lg:min-w-0 lg:flex-1">
            <p className="text-[11px] tracking-normal text-indigo lg:tracking-[1px]">{step.number}</p>
            <div className="flex min-w-0 flex-col gap-[5px] lg:mt-[9px] lg:gap-[9px]">
              <h3 className="text-[13px] text-ink lg:text-[14px]">{step.title}</h3>
              <p className="text-[12px] leading-[1.5] text-muted lg:leading-[1.6]">
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
