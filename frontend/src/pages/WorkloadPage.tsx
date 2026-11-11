import { CalendarDays, LoaderCircle, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { loadWorkload, loadWorkloadInsights } from "../api/workload.ts"
import type { CourseLoad, DayLoad, WeekLoad, WorkloadInsights, WorkloadReport } from "../api/workload.ts"
import { SyllabusApiError } from "../api/syllabus.ts"
import { Button } from "../components/Button.tsx"
import { EmptyState } from "../components/EmptyState.tsx"
import { PageHeader } from "../components/PageHeader.tsx"
import { PageShell } from "../components/PageShell.tsx"
import { formatLongDate, formatMonthDay, formatTermRange, formatWeekday, isoDate } from "../lib/dates.ts"
import { usePageTitle } from "../lib/pageTitle.ts"

type Range = "week" | "four" | "semester"

export function WorkloadPage({ email, onLogout }: { email: string; onLogout: () => void }) {
  usePageTitle("Workload · Syllapin")
  const [report, setReport] = useState<WorkloadReport | null>(null)
  const [error, setError] = useState<string>()
  const [range, setRange] = useState<Range>("four")
  const [insights, setInsights] = useState<WorkloadInsights | null>(null)
  const [insightError, setInsightError] = useState<string>()
  const [insightLoading, setInsightLoading] = useState(false)

  useEffect(() => {
    let active = true
    loadWorkload(isoDate(new Date()))
      .then((next) => {
        if (active) {
          setReport(next)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof SyllabusApiError ? caught.message : "Could not load the workload")
        }
      })
    return () => {
      active = false
    }
  }, [])

  async function askForSuggestions() {
    setInsightLoading(true)
    setInsightError(undefined)
    try {
      setInsights(await loadWorkloadInsights(isoDate(new Date())))
    } catch (caught) {
      setInsights(null)
      setInsightError(caught instanceof SyllabusApiError ? caught.message : "Suggestions are unavailable")
    } finally {
      setInsightLoading(false)
    }
  }

  const empty = report !== null && report.courses.length === 0 && report.semesterStart === null

  return (
    <PageShell email={email} onLogout={onLogout}>
          <PageHeader
            eyebrow="Workload"
            title="This semester at a glance"
            description={
              report?.semesterStart && report.semesterEnd
                ? `${formatTermRange(report.semesterStart, report.semesterEnd)}. Counts come from confirmed calendar events, not estimates of hours.`
                : "Counts come from the courses and confirmed events already on your calendar."
            }
          />

          {report === null && !error ? (
            <EmptyState
              icon={LoaderCircle}
              tone="loading"
              title="Loading your workload"
              message="Counting confirmed deadlines across your saved courses."
            />
          ) : null}
          {error ? (
            <EmptyState
              icon={TriangleAlert}
              tone="error"
              title="The workload couldn’t load"
              message={error}
              action={
                <div className="w-full max-w-xs">
                  <Button onClick={() => window.location.reload()}>Try again</Button>
                </div>
              }
            />
          ) : null}
          {empty ? (
            <EmptyState
              icon={CalendarDays}
              title="No saved deadlines yet"
              message="Review a syllabus and open its calendar. This page counts those confirmed dates. It does not estimate how long work will take."
              action={
                <a href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo px-4 text-[13px] font-medium text-white hover:bg-indigo-deep">
                  <Upload size={17} strokeWidth={1.75} aria-hidden />
                  Upload a syllabus
                </a>
              }
            />
          ) : null}

          {report && !empty ? (
            <>
              <section aria-label="Overview" className="panel grid grid-cols-2 lg:grid-cols-6">
                <Metric label="Active courses" value={report.activeCourses} detail="Terms that include today" />
                <Metric label="Upcoming assignments" value={report.upcomingAssignments} detail="Assignments and projects" />
                <Metric label="Upcoming exams" value={report.upcomingExams} detail="Quizzes are counted separately" />
                <Metric label="Due this week" value={report.dueThisWeek} detail="From today through Saturday" />
                <Metric label="Due next week" value={report.dueNextWeek} detail="Sunday through Saturday" />
                <Metric
                  label="Busiest week"
                  value={report.busiestWeek ? report.busiestWeek.events : 0}
                  detail={report.busiestWeek ? formatTermRange(report.busiestWeek.start, report.busiestWeek.end) : "No upcoming deadlines"}
                />
              </section>

              <section className="panel p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">Weekly workload</h2>
                    <p className="mt-1 text-[12px] text-muted">Each bar is a count of events, split by type and course.</p>
                  </div>
                  <div className="segmented" role="tablist" aria-label="Chart range">
                    <RangeButton current={range} value="week" label="Current week" onSelect={setRange} />
                    <RangeButton current={range} value="four" label="Next 4 weeks" onSelect={setRange} />
                    <RangeButton current={range} value="semester" label="Entire semester" onSelect={setRange} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted">
                  <Legend swatch="bg-indigo" label="Assignments" />
                  <Legend swatch="bg-error" label="Exams" />
                  <Legend swatch="bg-placeholder" label="Other events" />
                </div>
                {range === "week" ? <DayChart days={report.currentWeek} today={report.today} /> : null}
                {range === "four" ? <WeekChart weeks={report.nextFourWeeks} /> : null}
                {range === "semester" ? (
                  report.semesterWeeks.length === 0 ? (
                    <p className="mt-6 text-[13px] text-muted">Add a term or a confirmed event to see the semester.</p>
                  ) : (
                    <>
                      {report.semesterTruncated ? (
                        <p className="mt-4 text-[12px] text-muted">Showing 52 weeks around today.</p>
                      ) : null}
                      <WeekChart weeks={report.semesterWeeks} />
                    </>
                  )
                ) : null}
              </section>

              <section className="panel overflow-hidden">
                <h2 className="border-b border-hairline px-5 py-3 text-[13px] font-medium text-ink">Courses</h2>
                {report.courses.length === 0 ? (
                  <p className="px-5 py-6 text-[13px] text-muted">
                    No active course has an upcoming deadline.
                  </p>
                ) : (
                  report.courses.map((course) => <CourseCard key={course.id} course={course} />)
                )}
              </section>

              <section className="panel grid grid-cols-1 lg:grid-cols-2">
                <article className="border-b border-hairline p-5 lg:border-r lg:border-b-0">
                  <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">Busy periods</h2>
                  <p className="mt-1 text-[12px] leading-5 text-muted">These are counts from the calendar. They are not a difficulty score.</p>
                  {report.busyWeeks.length === 0 && report.crowdedDays.length === 0 && report.overlaps.length === 0 ? (
                    <p className="mt-4 text-[13px] text-muted">No crowded week, day, or time overlap is coming up.</p>
                  ) : (
                    <ul className="mt-4 flex flex-col gap-3">
                      {report.busyWeeks.map((week) => (
                        <li key={week.start} className="rounded-md bg-indigo-soft px-3 py-2.5">
                          <p className="text-[13px] text-ink">{formatTermRange(week.start, week.end)}</p>
                          <p className="mt-1 text-[12px] text-muted">{week.events} events · {week.reasons.join(" · ")}</p>
                        </li>
                      ))}
                      {report.overlaps.map((overlap) => (
                        <li key={overlap.date} className="rounded-md bg-error-soft px-3 py-2.5">
                          <p className="text-[13px] text-ink">{formatLongDate(overlap.date)}</p>
                          <p className="mt-1 text-[12px] text-error">{overlap.titles.join(" and ")} overlap in time.</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className="p-5">
                  <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">From your calendar</h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {report.facts.map((fact) => (
                      <li key={fact} className="border-l-2 border-indigo-line pl-3 text-[13px] leading-[1.55] text-ink">
                        {fact}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 border-t border-hairline pt-4">
                    <h3 className="text-[13px] text-ink">Suggestions</h3>
                    <p className="mt-1 text-[12px] leading-[1.5] text-muted">
                      Suggestions are separate from the counts. They are not used to invent hours, difficulty, or grades.
                    </p>
                    {insights === null ? (
                      <button
                        type="button"
                        onClick={() => void askForSuggestions()}
                        disabled={insightLoading}
                        className="mt-3 h-9 rounded-md bg-indigo px-3.5 text-[13px] font-medium text-white hover:bg-indigo-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo disabled:bg-disabled disabled:text-disabled-ink"
                      >
                        {insightLoading ? "Writing suggestions…" : "Get suggestions"}
                      </button>
                    ) : null}
                    {insightError ? (
                      <p role="alert" className="mt-3 text-[12px] text-error">
                        {insightError}
                      </p>
                    ) : null}
                    {insights && !insights.available ? (
                      <p className="mt-3 text-[12px] text-muted">Suggestions are unavailable. The counts above are unchanged.</p>
                    ) : null}
                    {insights && insights.available && insights.suggestions.length === 0 ? (
                      <p className="mt-3 text-[12px] text-muted">No suggestion stayed within the calculated facts.</p>
                    ) : null}
                    {insights && insights.suggestions.length > 0 ? (
                      <ul className="mt-3 flex flex-col gap-2">
                        {insights.suggestions.map((suggestion) => (
                          <li key={suggestion} className="text-[13px] leading-[1.55] text-muted">
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              </section>
            </>
          ) : null}
    </PageShell>
  )
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="border-b border-hairline px-4 py-3.5 last:border-b-0 even:border-l lg:border-b-0 lg:border-r lg:last:border-r-0 lg:even:border-l-0">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 text-[22px] leading-none font-medium tracking-[-0.03em] tabular-nums text-ink">{value}</p>
      <p className="mt-1.5 text-[12px] leading-4 text-muted">{detail}</p>
    </article>
  )
}

function CourseCard({ course }: { course: CourseLoad }) {
  const weights = course.weightsPresent.length
    ? course.weightsPresent.map((weight) => `${trimNumber(weight)}%`).join(", ")
    : null
  return (
    <article className="border-b border-hairline px-5 py-4 last:border-b-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[15px] font-medium tracking-[-0.01em] text-ink">{course.name}</h3>
          {course.termStart && course.termEnd ? (
            <p className="mt-1 text-[12px] text-muted">{formatTermRange(course.termStart, course.termEnd)}</p>
          ) : null}
        </div>
        <p className="text-[12px] text-muted">
          {course.eventShare === null ? "No upcoming events" : `${course.eventShare}% of upcoming events`}
        </p>
      </div>
      {course.eventShare !== null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-well" aria-hidden>
          <div className="h-full rounded-full bg-indigo" style={{ width: `${Math.min(100, course.eventShare)}%` }} />
        </div>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-medium text-muted">Assignments</dt>
          <dd className="mt-1 text-ink">{course.upcomingAssignments}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-muted">Exams</dt>
          <dd className="mt-1 text-ink">{course.upcomingExams}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-muted">Weight</dt>
          <dd className="mt-1 text-ink">{weights ?? "Not specified"}</dd>
        </div>
      </dl>
      {course.weightsMissing > 0 ? (
        <p className="mt-2 text-[12px] text-muted">
          {course.weightsMissing} upcoming {course.weightsMissing === 1 ? "event has" : "events have"} no weight.
        </p>
      ) : null}
      {course.deadlines.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {course.deadlines.slice(0, 6).map((deadline) => (
            <li key={`${deadline.date}-${deadline.title}`} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink">
                {deadline.title}
                <span className="ml-2 text-[11px] text-muted">{labelType(deadline.type)}</span>
              </span>
              <span className="shrink-0 text-[12px] text-muted">
                {formatLongDate(deadline.date)}
                {deadline.weightPercent === null ? "" : ` · ${trimNumber(deadline.weightPercent)}%`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[12px] text-muted">No upcoming deadlines.</p>
      )}
      {course.deadlines.length > 6 ? (
        <p className="mt-2 text-[12px] text-muted">{course.deadlines.length - 6} more deadlines are on the calendar.</p>
      ) : null}
    </article>
  )
}

function DayChart({ days, today }: { days: DayLoad[]; today: string }) {
  const max = Math.max(1, ...days.map((day) => day.total))
  return (
    <div className="mt-6 grid grid-cols-7 gap-2">
      {days.map((day) => {
        const parts = formatMonthDay(day.date)
        return (
          <div key={day.date} className={`flex flex-col items-center gap-2 ${day.date === today ? "text-indigo" : ""}`}>
            <div className="flex h-36 w-full items-end">
              <Stacked total={day.total} max={max} assignments={day.assignments} exams={day.exams} other={day.other} />
            </div>
            <p className="text-center text-[10px] text-muted">
              <span className="block">{formatWeekday(day.date)}</span>
              <span className={day.date === today ? "text-indigo" : "text-ink"}>{parts.day}</span>
            </p>
            <p className="text-[11px] text-ink">{day.total}</p>
          </div>
        )
      })}
    </div>
  )
}

function WeekChart({ weeks }: { weeks: WeekLoad[] }) {
  const max = Math.max(1, ...weeks.map((week) => week.total))
  return (
    <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
      {weeks.map((week) => (
        <div key={week.start} className="flex w-16 shrink-0 flex-col items-center gap-2">
          <div className="flex h-36 w-full items-end">
            <Stacked total={week.total} max={max} assignments={week.assignments} exams={week.exams} other={week.other} />
          </div>
          <p className="text-center text-[10px] leading-tight text-muted">{formatMonthDay(week.start).month} {formatMonthDay(week.start).day}</p>
          <p className="text-[11px] text-ink">{week.total}</p>
          {week.courses.length > 0 ? (
            <p className="line-clamp-3 text-center text-[10px] leading-tight text-muted">
              {week.courses.map((course) => `${course.name} ${course.events}`).join(", ")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function Stacked({
  total,
  max,
  assignments,
  exams,
  other,
}: {
  total: number
  max: number
  assignments: number
  exams: number
  other: number
}) {
  const height = total === 0 ? 0 : Math.max(8, Math.round((total / max) * 144))
  return (
    <div className="flex w-full flex-col-reverse overflow-hidden rounded-md" style={{ height }} aria-hidden>
      <span className="bg-indigo" style={{ height: share(assignments, total) }} />
      <span className="bg-error" style={{ height: share(exams, total) }} />
      <span className="bg-placeholder" style={{ height: share(other, total) }} />
    </div>
  )
}

function RangeButton({
  current,
  value,
  label,
  onSelect,
}: {
  current: Range
  value: Range
  label: string
  onSelect: (value: Range) => void
}) {
  const selected = current === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${swatch}`} />
      {label}
    </span>
  )
}

function share(count: number, total: number): string {
  if (total === 0 || count === 0) {
    return "0%"
  }
  return `${(count / total) * 100}%`
}

function labelType(type: string): string {
  const lower = type.toLowerCase()
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
