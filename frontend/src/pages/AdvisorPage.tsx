import { ArrowRight, ArrowUp, ArrowUpRight, CalendarDays, Check, LoaderCircle, Sparkles, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { askAdvisor, loadAdvisor } from "../api/advisor.ts"
import type { AdvisorAnalysis, AdvisorTurn, Citation, CourseBrief, DeadlineNote } from "../api/advisor.ts"
import { SyllabusApiError } from "../api/syllabus.ts"
import { Button } from "../components/Button.tsx"
import { EmptyState } from "../components/EmptyState.tsx"
import { PageShell } from "../components/PageShell.tsx"
import { addDays, formatLongDate, formatTermRange, formatTimeRange, isoDate, parseIsoDate } from "../lib/dates.ts"
import { usePageTitle } from "../lib/pageTitle.ts"

const SUGGESTED = [
  "Which course needs attention next month?",
  "What should I prioritize this week?",
  "Which courses have the most exams?",
  "Where do deadlines overlap?",
  "How should I plan the next two weeks?",
  "How should I prepare for my next exam?",
]

type Message = AdvisorTurn & {
  citations?: Citation[]
  withheld?: boolean
}

export function AdvisorPage({ email, onLogout, isGuest = false }: { email: string; onLogout: () => void; isGuest?: boolean }) {
  usePageTitle("Advisor · Syllapin")
  const [analysis, setAnalysis] = useState<AdvisorAnalysis | null>(null)
  const [error, setError] = useState<string>()
  const [selected, setSelected] = useState<string[] | null>(null)
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string>()

  useEffect(() => {
    let active = true
    loadAdvisor(isoDate(new Date()))
      .then((next) => {
        if (active) setAnalysis(next)
      })
      .catch((caught) => {
        if (active) setError(caught instanceof SyllabusApiError ? caught.message : "Could not load the advisor")
      })
    return () => { active = false }
  }, [])

  const courses = analysis?.courses ?? []
  const chosenIds = selected ?? courses.map((c) => c.id)
  const chosen = courses.filter((c) => chosenIds.includes(c.id))
  const empty = analysis !== null && courses.length === 0

  const totalConfirmed = chosen.reduce((s, c) => s + c.assignments + c.exams + c.quizzes + c.projects + c.admin + c.other, 0)
  const totalUpcoming = chosen.reduce((s, c) => s + c.upcoming, 0)
  const totalMissingWeights = chosen.reduce((s, c) => s + c.weightsMissing, 0)
  const termCourse = chosen.find((c) => c.termStart && c.termEnd)
  const termLabel = termCourse?.termStart && termCourse?.termEnd
    ? formatTermRange(termCourse.termStart, termCourse.termEnd)
    : null

  function toggleCourse(id: string) {
    const current = selected ?? courses.map((c) => c.id)
    setSelected(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }

  async function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || asking || chosenIds.length === 0) return
    const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }))
    setQuestion("")
    setAskError(undefined)
    setAsking(true)
    setMessages((cur) => [...cur, { role: "user", text: trimmed }])
    try {
      const reply = await askAdvisor({ today: isoDate(new Date()), courseIds: chosenIds, question: trimmed, history })
      setMessages((cur) => [
        ...cur,
        reply.available && reply.answer
          ? { role: "assistant", text: reply.answer, citations: reply.citations }
          : {
              role: "assistant",
              withheld: true,
              text: reply.status === "rejected"
                ? "That reply was set aside because it added a number, a study hour, or a graduation claim that is not in the saved calendar. The counts above still come from your confirmed events."
                : "The model is unavailable. The counts above are unchanged.",
            },
      ])
    } catch (caught) {
      setMessages((cur) => cur.slice(0, -1))
      setQuestion(trimmed)
      setAskError(caught instanceof SyllabusApiError ? caught.message : "The advisor could not answer")
    } finally {
      setAsking(false)
    }
  }

  return (
    <PageShell email={email} onLogout={onLogout} contained={false} isGuest={isGuest}>
      <div className="mx-auto flex w-full max-w-[1344px] flex-col gap-8 px-5 pb-16 pt-8 lg:px-8 lg:pt-10 xl:px-12">

        {/* Page intro */}
        <header>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo">Advisor</span>
            {termLabel ? <span className="text-[13px] text-muted">{termLabel}</span> : null}
          </div>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink lg:text-[42px]">
            Your semester, in focus.
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-muted">Plan from confirmed dates, with a little perspective.</p>
        </header>

        {/* Loading / error / empty states */}
        {analysis === null && !error ? (
          <EmptyState
            icon={LoaderCircle}
            tone="loading"
            title="Loading your courses"
            message="Reading the confirmed events already on your calendar."
          />
        ) : null}
        {error ? (
          <EmptyState
            icon={TriangleAlert}
            tone="error"
            title="The advisor couldn't load"
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
            title="No saved courses yet"
            message="Review a syllabus and open its calendar. The advisor reads those confirmed events. The original file is not kept."
            action={
              <a href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo px-4 text-[13px] font-medium text-white hover:bg-indigo-deep active:bg-indigo-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo">
                <Upload size={17} strokeWidth={1.75} aria-hidden />
                Upload a syllabus
              </a>
            }
          />
        ) : null}

        {analysis && !empty ? (
          <>
            {/* Overview metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <OverviewMetric label="Selected courses" value={chosen.length} detail="Included in this view" />
              <OverviewMetric label="Confirmed events" value={totalConfirmed} detail="Saved to your calendar" />
              <OverviewMetric label="Upcoming events" value={totalUpcoming} detail={chosen.length === 1 ? "In this course" : "Across selected courses"} />
              <OverviewMetric label="Missing weights" value={totalMissingWeights} detail="Events without a weight" />
            </div>

            {/* Two-column layout — right col is first in DOM so it appears first on mobile */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_440px]">

              {/* Right column: AI Advisor (desktop) + Calendar insights */}
              <div className="flex flex-col gap-8 lg:col-start-2 lg:row-start-1">
                <AiAdvisorSection
                  courses={courses}
                  chosenIds={chosenIds}
                  onToggle={toggleCourse}
                  messages={messages}
                  asking={asking}
                  askError={askError}
                  question={question}
                  setQuestion={setQuestion}
                  onSubmit={submit}
                />
                {/* Calendar insights: desktop only here; mobile version is below in the left col */}
                <div className="hidden lg:block">
                  <CalendarInsightsSection analysis={analysis} courseIds={chosenIds} />
                </div>
              </div>

              {/* Left column: Course planning */}
              <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-1">
                <WeeklyWorkloadSection analysis={analysis} courseIds={chosenIds} />
                <CourseComparisonSection courses={courses} chosen={chosen} chosenIds={chosenIds} onToggle={toggleCourse} />
                <ConfirmedCoursesSection chosen={chosen} />
                {/* Calendar insights: mobile/tablet only */}
                <div className="lg:hidden">
                  <CalendarInsightsSection analysis={analysis} courseIds={chosenIds} />
                </div>
              </div>
            </div>

            <p className="text-[12px] leading-5 text-muted">
              A planning aid, not a graduation-eligibility decision or a replacement for official advising. Always double-check dates against your syllabus.
            </p>
          </>
        ) : null}
      </div>
    </PageShell>
  )
}

/* ─── Overview metrics ─────────────────────────────────────────────────────── */

function OverviewMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="panel px-5 py-4">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-[32px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-ink">{value}</p>
      <p className="mt-1.5 text-[12px] leading-[1.4] text-muted">{detail}</p>
    </article>
  )
}

/* ─── Weekly workload ───────────────────────────────────────────────────────── */

function WeeklyWorkloadSection({ analysis, courseIds }: { analysis: AdvisorAnalysis; courseIds: string[] }) {
  const filtered = (analysis.upcomingExams ?? []).filter((e) => courseIds.includes(e.courseId))
  const weeks = groupExamsByWeek(filtered)
  const max = Math.max(1, ...weeks.map((w) => w.count))

  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Weekly workload</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">Exam milestones saved to the selected courses, grouped by week.</p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Exams</span>
      </div>

      {weeks.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted">
          {courseIds.length === 0 ? "Select a course to see exam milestones." : "No upcoming exams are saved for the selected courses."}
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {weeks.map((week) => (
            <div key={week.start}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[13px] text-ink">{formatTermRange(week.start, week.end)}</span>
                <span className="text-[12px] font-medium text-indigo">{week.count} {week.count === 1 ? "exam" : "exams"}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-well">
                <div
                  className="h-full rounded-full bg-indigo transition-all duration-300"
                  style={{ width: `${(week.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-5 text-[12px] text-muted">Exam weeks only · Not a full weekly workload or study-hour estimate.</p>
    </section>
  )
}

/* ─── Course comparison ─────────────────────────────────────────────────────── */

function CourseComparisonSection({
  courses,
  chosen,
  chosenIds,
  onToggle,
}: {
  courses: CourseBrief[]
  chosen: CourseBrief[]
  chosenIds: string[]
  onToggle: (id: string) => void
}) {
  const compRows: { label: string; value: (c: CourseBrief) => number }[] = [
    { label: "Assignments", value: (c) => c.assignments },
    { label: "Exams", value: (c) => c.exams },
    { label: "Quizzes", value: (c) => c.quizzes },
    { label: "Projects", value: (c) => c.projects },
    { label: "Admin", value: (c) => c.admin },
    { label: "Other", value: (c) => c.other },
    { label: "Upcoming", value: (c) => c.upcoming },
    { label: "Weights saved", value: (c) => c.weightTotal },
    { label: "Weights missing", value: (c) => c.weightsMissing },
  ]

  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Course comparison</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">Choose which courses to compare and include in advisor questions.</p>
        </div>
        <span className="shrink-0 text-[13px] text-muted">{chosenIds.length} selected</span>
      </div>

      <fieldset className="mt-4 flex flex-wrap gap-2">
        <legend className="sr-only">Courses to include</legend>
        {courses.map((course) => {
          const checked = chosenIds.includes(course.id)
          return (
            <label
              key={course.id}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] transition-colors ${
                checked
                  ? "border-indigo bg-indigo-soft text-indigo"
                  : "border-hairline text-muted hover:border-indigo-line"
              }`}
            >
              <input type="checkbox" className="sr-only" checked={checked} onChange={() => onToggle(course.id)} />
              {checked ? <Check size={12} strokeWidth={2.5} aria-hidden /> : null}
              {course.name}
            </label>
          )
        })}
      </fieldset>

      {chosen.length >= 2 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-[11px] tracking-[0.4px] text-muted">
                <th className="py-2 pr-3 font-medium">Count</th>
                {chosen.map((c) => (
                  <th key={c.id} className="px-3 py-2 font-medium text-ink">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compRows.map((row) => (
                <tr key={row.label} className="border-b border-hairline last:border-0">
                  <th className="py-2 pr-3 font-normal text-muted">{row.label}</th>
                  {chosen.map((c) => (
                    <td key={c.id} className="px-3 py-2 tabular-nums text-ink">{row.value(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-muted">
          {chosen.length === 0 ? "Select at least one course above." : "Select at least two courses to compare them side by side."}
        </p>
      )}

      <p className="mt-4 text-[12px] text-muted">Counts from confirmed events. They do not measure difficulty.</p>
    </section>
  )
}

/* ─── Confirmed courses ─────────────────────────────────────────────────────── */

function ConfirmedCoursesSection({ chosen }: { chosen: CourseBrief[] }) {
  if (chosen.length === 0) {
    return (
      <section>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Confirmed courses</h2>
        <p className="mt-3 text-[13px] text-muted">Select a course above to see its details.</p>
      </section>
    )
  }
  return (
    <section>
      <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Confirmed courses</h2>
      <div className="mt-4 flex flex-col gap-4">
        {chosen.map((course) => (
          <ConfirmedCourseCard key={course.id} course={course} />
        ))}
      </div>
    </section>
  )
}

function ConfirmedCourseCard({ course }: { course: CourseBrief }) {
  const term = course.termStart && course.termEnd
    ? formatTermRange(course.termStart, course.termEnd)
    : "Term dates are incomplete."
  const totalEvents = course.assignments + course.exams + course.quizzes + course.projects + course.admin + course.other
  const counts = [
    ["Assignments", course.assignments],
    ["Exams", course.exams],
    ["Quizzes", course.quizzes],
    ["Projects", course.projects],
    ["Admin", course.admin],
    ["Other", course.other],
  ] as const

  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{course.name}</h3>
          <p className="mt-0.5 text-[12px] text-muted">{term}</p>
          <p className="mt-1 text-[12px] text-muted">
            {totalEvents} confirmed events · {course.weightTotal} {course.weightTotal === 1 ? "weight" : "weights"} saved
          </p>
        </div>
        <span className="shrink-0 text-[13px] font-medium text-indigo">{course.upcoming} upcoming</span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {counts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <details className="mt-5">
        <summary className="cursor-pointer text-[13px] font-medium text-indigo hover:text-indigo-deep focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo">
          Weights, deadlines, and busy weeks
        </summary>
        <div className="mt-4">
          <h4 className="text-[13px] text-ink">Weights saved on events</h4>
          {course.weights.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">Not specified.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {course.weights.map((weight) => (
                <li key={weight.eventId} className="text-[13px] text-ink">
                  {weight.title} · {formatLongDate(weight.date)} · {weight.weight}%
                  <span className="ml-2 text-[11px] text-muted">Saved on this event</span>
                </li>
              ))}
            </ul>
          )}
          {course.weightTotal > course.weights.length ? (
            <p className="mt-2 text-[12px] text-muted">Showing {course.weights.length} of {course.weightTotal} saved weights.</p>
          ) : null}
          {course.weightsMissing > 0 ? (
            <p className="mt-2 text-[12px] text-muted">{course.weightsMissing} events have no weight saved.</p>
          ) : null}

          <h4 className="mt-5 text-[13px] text-ink">Upcoming deadlines</h4>
          {course.deadlines.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">No upcoming event is saved for this course.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {course.deadlines.map((deadline) => (
                <DeadlineRow key={deadline.eventId} deadline={deadline} />
              ))}
            </ul>
          )}
          {course.upcomingTotal > course.deadlines.length ? (
            <p className="mt-2 text-[12px] text-muted">Showing {course.deadlines.length} of {course.upcomingTotal} upcoming events.</p>
          ) : null}

          {course.busyWeeks.length > 0 ? (
            <div className="mt-4">
              <h4 className="text-[13px] text-ink">Busy weeks for this course</h4>
              <ul className="mt-2 flex flex-col gap-1">
                {course.busyWeeks.map((week) => (
                  <li key={week.start} className="text-[12px] text-muted">
                    {formatTermRange(week.start, week.end)} · {week.events} events · {week.reasons.join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  )
}

/* ─── AI Advisor section ────────────────────────────────────────────────────── */

function AiAdvisorSection({
  courses,
  chosenIds,
  onToggle,
  messages,
  asking,
  askError,
  question,
  setQuestion,
  onSubmit,
}: {
  courses: CourseBrief[]
  chosenIds: string[]
  onToggle: (id: string) => void
  messages: Message[]
  asking: boolean
  askError: string | undefined
  question: string
  setQuestion: (q: string) => void
  onSubmit: (text: string) => Promise<void>
}) {
  return (
    <section className="panel flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-soft">
            <Sparkles size={13} className="text-indigo" aria-hidden />
          </div>
          <span className="text-[13px] font-semibold text-ink">AI Advisor</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Syllapin</span>
      </div>

      {/* Headline */}
      <div className="mt-5">
        <h2 className="font-serif text-[28px] italic leading-[1.2] text-ink">Make sense of your semester.</h2>
        <p className="mt-2 text-[13px] leading-5 text-muted">
          Ask about deadlines, exams, and what's coming up across your courses.
        </p>
      </div>

      {/* Course filter chips */}
      {courses.length > 0 ? (
        <fieldset className="mt-5 flex flex-wrap gap-2">
          <legend className="sr-only">Courses to include in this question</legend>
          {courses.map((course) => {
            const checked = chosenIds.includes(course.id)
            return (
              <label
                key={course.id}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
                  checked
                    ? "border-indigo bg-indigo-soft text-indigo"
                    : "border-hairline text-muted hover:border-indigo-line"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => onToggle(course.id)} />
                {checked ? <Check size={11} strokeWidth={2.5} aria-hidden /> : null}
                {course.name}
              </label>
            )
          })}
        </fieldset>
      ) : null}

      {/* Suggested questions */}
      <div className="mt-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Start with a question</p>
        <div className="flex flex-col divide-y divide-hairline">
          {SUGGESTED.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void onSubmit(prompt)}
              disabled={asking || chosenIds.length === 0}
              className="flex items-center justify-between py-3 text-left text-[13px] text-ink hover:text-indigo disabled:cursor-not-allowed disabled:text-disabled-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              <span>{prompt}</span>
              <ArrowUpRight size={14} className="ml-3 shrink-0 text-muted" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {/* Message thread */}
      {messages.length > 0 ? (
        <div className="mt-5 flex flex-col gap-3" aria-live="polite">
          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={message.role === "user" ? "max-w-[480px] self-end" : "max-w-[560px]"}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted">
                {message.role === "user" ? "You" : message.withheld ? "Couldn't answer" : "Advisor"}
              </p>
              <p
                className={`mt-1 rounded-lg px-3.5 py-2.5 text-[13px] leading-5 ${
                  message.role === "user" ? "bg-indigo text-white" : "bg-well text-ink"
                }`}
              >
                {message.text}
              </p>
              {message.citations && message.citations.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-2">
                  {message.citations.map((citation) => (
                    <li key={citation.eventId} className="rounded-md border border-hairline px-3 py-2 text-[12px] leading-5 text-muted">
                      <span className="text-ink">{citation.courseName}</span>
                      {" · "}{citation.title}{" · "}{formatLongDate(citation.date)}
                      {citation.weight === null ? " · Weight not saved" : ` · ${citation.weight}% saved on this event`}
                      {citation.quote ? <span className="mt-1 block text-ink">Quote: {citation.quote}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
          {asking ? <p className="text-[13px] text-muted">Reading the saved calendar…</p> : null}
        </div>
      ) : null}

      {askError ? (
        <p role="alert" className="mt-3 text-[12px] text-error">{askError}</p>
      ) : null}

      {/* Input */}
      <form
        className="mt-5 rounded-lg border border-hairline p-3 focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo-soft"
        onSubmit={(e) => { e.preventDefault(); void onSubmit(question) }}
      >
        <label className="sr-only" htmlFor="advisor-question">Question</label>
        <input
          id="advisor-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ask about the selected courses…"
          className="w-full border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted">Selected courses only</span>
          <button
            type="submit"
            disabled={asking || chosenIds.length === 0 || question.trim().length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-indigo px-3.5 text-[13px] font-medium text-white hover:bg-indigo-deep disabled:bg-disabled disabled:text-disabled-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            {asking ? "Asking…" : (
              <>
                Ask
                <ArrowUp size={13} aria-hidden />
              </>
            )}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => void onSubmit("Summarize the selected courses using only the saved events, weights, and counts.")}
        disabled={asking || chosenIds.length === 0}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-indigo hover:text-indigo-deep disabled:cursor-not-allowed disabled:text-disabled-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
      >
        Summarize selected courses
        <ArrowRight size={13} aria-hidden />
      </button>

      <p className="mt-5 border-t border-hairline pt-4 text-[11px] leading-[1.6] text-muted">
        A question sends the selected course names, event titles, dates, times, locations, weights, and saved syllabus quotes to Gemini. It does not send your email or the original file. The thread stays in this browser tab.
      </p>
    </section>
  )
}

/* ─── Calendar insights ─────────────────────────────────────────────────────── */

function CalendarInsightsSection({ analysis, courseIds }: { analysis: AdvisorAnalysis; courseIds: string[] }) {
  const selectedAll = courseIds.length === analysis.courses.length
  const upcoming = (analysis.upcomingExams ?? []).filter((e) => courseIds.includes(e.courseId))
  const soon = upcoming.filter((e) => calendarDays(analysis.today, e.date) <= 14)
  const visibleNext = upcoming[0] ?? null
  const preparation = visibleNext ? preparationNote(analysis.today, visibleNext.date) : null

  return (
    <section>
      <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">What the calendar supports</h2>
      <p className="mt-1 text-[13px] text-muted">
        Confirmed dates, with their limits in view.
        {selectedAll ? "" : " Busy weeks and overlaps include every saved course."}
      </p>

      {/* Next exam */}
      <div className="mt-5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Next exam</span>
          {visibleNext ? <span className="text-[13px] text-muted">{formatLongDate(visibleNext.date)}</span> : null}
        </div>
        {visibleNext ? (
          <div>
            <p className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {visibleNext.courseName} · {visibleNext.title}
            </p>
            {visibleNext.quote ? (
              <p className="mt-1 text-[12px] italic text-muted">"{visibleNext.quote}"</p>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-muted">No upcoming exam is saved for the selected courses.</p>
        )}
      </div>

      {/* Planning context */}
      <ul className="mt-4 flex flex-col gap-2.5">
        {preparation ? <li className="text-[13px] leading-[1.55] text-ink">{preparation}</li> : null}
        <li className="text-[13px] leading-[1.55] text-ink">
          {soon.length === 0
            ? "No selected course has an exam in the next 14 days."
            : `Exams in the next 14 days: ${soon.map((e) => `${e.courseName} ${e.title} on ${formatLongDate(e.date)}`).join("; ")}.`}
        </li>
        {analysis.busyWeeks.length === 0 ? (
          <li className="text-[13px] text-muted">No upcoming week matched a busy-week rule.</li>
        ) : (
          analysis.busyWeeks.map((week) => (
            <li key={week.start} className="text-[13px] leading-[1.55] text-ink">
              {formatTermRange(week.start, week.end)} · {week.events} events · {week.reasons.join(" · ")}
            </li>
          ))
        )}
        {analysis.overlaps.map((overlap) => (
          <li key={overlap.date} className="text-[13px] leading-[1.55] text-ink">
            {formatLongDate(overlap.date)} · {overlap.titles.join(" and ")} overlap in time.
          </li>
        ))}
      </ul>

      {/* Not on the calendar */}
      {analysis.missing.length > 0 ? (
        <div className="mt-5 border-t border-hairline pt-5">
          <h3 className="text-[13px] font-medium text-ink">Not on the calendar</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {analysis.missing.map((note) => (
              <li key={note} className="text-[12px] leading-[1.5] text-muted">{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

/* ─── Shared sub-components ─────────────────────────────────────────────────── */

function DeadlineRow({ deadline }: { deadline: DeadlineNote }) {
  const time = formatTimeRange(deadline.start, deadline.end)
  return (
    <li className="rounded-md border border-hairline px-3 py-2.5">
      <p className="text-[13px] text-ink">
        {deadline.title}
        <span className="ml-2 text-[11px] text-muted">{labelFor(deadline.type)}</span>
      </p>
      <p className="mt-1 text-[12px] text-muted">
        {formatLongDate(deadline.date)}
        {time ? ` · ${time}` : ""}
        {deadline.location ? ` · ${deadline.location}` : ""}
        {deadline.weight === null ? " · Weight not saved" : ` · ${deadline.weight}%`}
      </p>
      {deadline.quote ? (
        <p className="mt-2 text-[12px] leading-[1.5] text-ink">
          <span className="text-muted">Syllabus quote. </span>
          {deadline.quote}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-muted">No syllabus quote was saved on this event.</p>
      )}
    </li>
  )
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function calendarDays(today: string, examDate: string): number {
  const start = parseIsoDate(today).getTime()
  const end = parseIsoDate(examDate).getTime()
  return Math.round((end - start) / 86_400_000) + 1
}

function preparationNote(today: string, examDate: string): string {
  const days = calendarDays(today, examDate)
  return `There are ${days} calendar days from today through ${formatLongDate(examDate)}. The calendar does not record which of those days are free.`
}

function labelFor(type: string): string {
  const labels: Record<string, string> = {
    ASSIGNMENT: "Assignment",
    EXAM: "Exam",
    QUIZ: "Quiz",
    PROJECT: "Project",
    ADMIN: "Admin",
    OTHER: "Other",
  }
  return labels[type] ?? "Other"
}

function mondayOfWeek(iso: string): string {
  const date = parseIsoDate(iso)
  const day = date.getDay()
  return isoDate(addDays(date, day === 0 ? -6 : 1 - day))
}

function groupExamsByWeek(
  exams: { date: string }[]
): { start: string; end: string; count: number }[] {
  const map = new Map<string, { start: string; end: string; count: number }>()
  for (const exam of exams) {
    const start = mondayOfWeek(exam.date)
    const end = isoDate(addDays(parseIsoDate(start), 6))
    const slot = map.get(start)
    if (slot) { slot.count++ }
    else { map.set(start, { start, end, count: 1 }) }
  }
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start))
}
