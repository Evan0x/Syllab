import { CalendarDays, LoaderCircle, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { askAdvisor, loadAdvisor } from "../api/advisor.ts"
import type { AdvisorAnalysis, AdvisorTurn, Citation, CourseBrief, DeadlineNote } from "../api/advisor.ts"
import { SyllabusApiError } from "../api/syllabus.ts"
import { Button } from "../components/Button.tsx"
import { EmptyState } from "../components/EmptyState.tsx"
import { PageHeader } from "../components/PageHeader.tsx"
import { PageShell } from "../components/PageShell.tsx"
import { formatLongDate, formatTermRange, formatTimeRange, isoDate, parseIsoDate } from "../lib/dates.ts"
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

export function AdvisorPage({ email, onLogout }: { email: string; onLogout: () => void }) {
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
        if (active) {
          setAnalysis(next)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof SyllabusApiError ? caught.message : "Could not load the advisor")
        }
      })
    return () => {
      active = false
    }
  }, [])

  const courses = analysis?.courses ?? []
  const chosenIds = selected ?? courses.map((course) => course.id)
  const chosen = courses.filter((course) => chosenIds.includes(course.id))
  const empty = analysis !== null && courses.length === 0

  function toggleCourse(id: string) {
    const current = selected ?? courses.map((course) => course.id)
    setSelected(current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || asking || chosenIds.length === 0) {
      return
    }
    const history = messages.slice(-6).map((message) => ({ role: message.role, text: message.text }))
    setQuestion("")
    setAskError(undefined)
    setAsking(true)
    setMessages((current) => [...current, { role: "user", text: trimmed }])
    try {
      const reply = await askAdvisor({
        today: isoDate(new Date()),
        courseIds: chosenIds,
        question: trimmed,
        history,
      })
      setMessages((current) => [
        ...current,
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
      setMessages((current) => current.slice(0, -1))
      setQuestion(trimmed)
      setAskError(caught instanceof SyllabusApiError ? caught.message : "The advisor could not answer")
    } finally {
      setAsking(false)
    }
  }

  return (
    <PageShell email={email} onLogout={onLogout}>
          <PageHeader
            eyebrow="Advisor"
            title="Plan from confirmed dates"
            description="Counts, dates, and weights come from saved calendar events. This is a planning aid. It does not decide graduation eligibility or replace official advising."
          />

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
              title="The advisor couldn’t load"
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
              <section className="panel p-5">
                <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">Courses</h2>
                <p className="mt-1 text-[12px] leading-[1.5] text-muted">
                  Choose the courses to compare and to include in a question.
                </p>
                <fieldset className="mt-4 flex flex-wrap gap-2">
                  <legend className="sr-only">Courses to include</legend>
                  {courses.map((course) => {
                    const checked = chosenIds.includes(course.id)
                    return (
                      <label
                        key={course.id}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] ${checked ? "border-indigo bg-indigo-soft text-ink" : "border-hairline text-muted"}`}
                      >
                        <input
                          type="checkbox"
                          className="accent-indigo"
                          checked={checked}
                          onChange={() => toggleCourse(course.id)}
                        />
                        {course.name}
                      </label>
                    )
                  })}
                </fieldset>
              </section>

              {chosen.length >= 2 ? <Comparison courses={chosen} /> : null}
              {chosen.length === 0 ? (
                <p className="panel px-5 py-6 text-[13px] text-muted">
                  Select a course to see its counts.
                </p>
              ) : (
                chosen.map((course) => <CourseCard key={course.id} course={course} />)
              )}

              <Recommendations analysis={analysis} courseIds={chosenIds} />

              <section className="panel p-5">
                <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">Ask about these courses</h2>
                <p className="mt-1 text-[12px] leading-[1.5] text-muted">
                  A question sends the selected course names, event titles, dates, times, locations, weights, and saved syllabus quotes to Gemini. It does not send your email or the original file. The thread stays in this browser tab.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTED.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void submit(prompt)}
                      disabled={asking || chosenIds.length === 0}
                      className="rounded-md border border-hairline px-3 py-1.5 text-left text-[12px] text-ink hover:border-indigo hover:bg-indigo-soft disabled:cursor-not-allowed disabled:text-disabled-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3" aria-live="polite">
                  {messages.map((message, index) => (
                    <article key={`${message.role}-${index}`} className={message.role === "user" ? "self-end max-w-[520px]" : "max-w-[640px]"}>
                      <p className="text-[10px] font-semibold tracking-[1px] text-muted">
                        {message.role === "user" ? "You" : message.withheld ? "Couldn’t answer" : "Advisor"}
                      </p>
                      <p className={`mt-1 rounded-lg px-3.5 py-2.5 text-[13px] leading-5 ${message.role === "user" ? "bg-indigo text-white" : "bg-well text-ink"}`}>
                        {message.text}
                      </p>
                      {message.citations && message.citations.length > 0 ? (
                        <ul className="mt-2 flex flex-col gap-2">
                          {message.citations.map((citation) => (
                            <li key={citation.eventId} className="rounded-md border border-hairline px-3 py-2 text-[12px] leading-5 text-muted">
                              <span className="text-ink">{citation.courseName}</span>
                              {" · "}
                              {citation.title}
                              {" · "}
                              {formatLongDate(citation.date)}
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
                {askError ? (
                  <p role="alert" className="mt-3 text-[12px] text-error">
                    {askError}
                  </p>
                ) : null}
                <form
                  className="sticky bottom-4 mt-4 flex flex-col gap-2 rounded-md border border-hairline bg-canvas p-2 sm:flex-row sm:items-center"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submit(question)
                  }}
                >
                  <label className="sr-only" htmlFor="advisor-question">
                    Question
                  </label>
                  <input
                    id="advisor-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    maxLength={500}
                    placeholder="Ask about the selected courses"
                    className="control min-w-0 flex-1 border-0 bg-transparent shadow-none"
                  />
                  <button
                    type="submit"
                    disabled={asking || chosenIds.length === 0 || question.trim().length === 0}
                    className="h-10 shrink-0 rounded-md bg-indigo px-4 text-[13px] font-medium text-white hover:bg-indigo-deep disabled:bg-disabled disabled:text-disabled-ink"
                  >
                    {asking ? "Asking…" : "Ask"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => void submit("Summarize the selected courses using only the saved events, weights, and counts.")}
                  disabled={asking || chosenIds.length === 0}
                  className="mt-3 text-[12px] text-indigo hover:text-indigo-deep disabled:cursor-not-allowed disabled:text-disabled-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo focus-visible:rounded-sm"
                >
                  Summarize selected courses
                </button>
              </section>
            </>
          ) : null}
    </PageShell>
  )
}

function Comparison({ courses }: { courses: CourseBrief[] }) {
  const rows: { label: string; value: (course: CourseBrief) => number }[] = [
    { label: "Assignments", value: (course) => course.assignments },
    { label: "Exams", value: (course) => course.exams },
    { label: "Quizzes", value: (course) => course.quizzes },
    { label: "Projects", value: (course) => course.projects },
    { label: "Admin", value: (course) => course.admin },
    { label: "Other", value: (course) => course.other },
    { label: "Upcoming", value: (course) => course.upcoming },
    { label: "Weights saved", value: (course) => course.weightTotal },
    { label: "Weights missing", value: (course) => course.weightsMissing },
  ]
  return (
    <section className="panel p-5">
      <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">Comparison</h2>
      <p className="mt-1 text-[12px] leading-[1.5] text-muted">
        These are counts from confirmed events. They do not measure difficulty.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-hairline text-[11px] tracking-[0.4px] text-muted">
              <th className="py-2 pr-3 font-medium">Count</th>
              {courses.map((course) => (
                <th key={course.id} className="px-3 py-2 font-medium text-ink">
                  {course.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-hairline last:border-0">
                <th className="py-2 pr-3 font-normal text-muted">{row.label}</th>
                {courses.map((course) => (
                  <td key={course.id} className="px-3 py-2 text-ink">
                    {row.value(course)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CourseCard({ course }: { course: CourseBrief }) {
  const term = course.termStart && course.termEnd ? formatTermRange(course.termStart, course.termEnd) : "Term dates are incomplete."
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
      <p className="text-[11px] font-medium text-muted">Confirmed events</p>
      <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-ink">{course.name}</h2>
      <p className="mt-1 text-[12px] text-muted">{term}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="mt-0.5 text-[20px] leading-none font-medium tabular-nums tracking-[-0.03em] text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[12px] text-muted">{course.upcoming} upcoming</p>
      <details className="mt-5">
        <summary className="cursor-pointer text-[13px] font-medium text-ink hover:text-indigo">
          Weights, deadlines, and busy weeks
        </summary>
        <h3 className="mt-4 text-[13px] text-ink">Weights saved on events</h3>
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
        <h3 className="mt-5 text-[13px] text-ink">Upcoming deadlines</h3>
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
            <h3 className="text-[13px] text-ink">Busy weeks for this course</h3>
            <ul className="mt-2 flex flex-col gap-1">
              {course.busyWeeks.map((week) => (
                <li key={week.start} className="text-[12px] text-muted">
                  {formatTermRange(week.start, week.end)} · {week.events} events · {week.reasons.join(" · ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </details>
    </article>
  )
}

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

function Recommendations({ analysis, courseIds }: { analysis: AdvisorAnalysis; courseIds: string[] }) {
  const selectedAll = courseIds.length === analysis.courses.length
  const upcoming = (analysis.upcomingExams ?? []).filter((exam) => courseIds.includes(exam.courseId))
  const soon = upcoming.filter((exam) => calendarDays(analysis.today, exam.date) <= 14)
  const visibleNext = upcoming[0] ?? null
  const preparation = visibleNext ? preparationNote(analysis.today, visibleNext.date) : null
  return (
    <section className="panel p-5">
      <p className="text-[11px] font-medium text-muted">Calculated</p>
      <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-ink">What the calendar supports</h2>
      <p className="mt-1 text-[12px] leading-[1.5] text-muted">
        These lines are counts and saved dates. They do not assign study hours or say which days are free.
        {selectedAll ? "" : " Busy weeks and overlaps include every saved course."}
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        <li className="text-[13px] leading-[1.55] text-ink">
          {visibleNext ? (
            <>
              Next exam: {visibleNext.courseName} · {visibleNext.title} · {formatLongDate(visibleNext.date)}
              {visibleNext.quote ? <span className="mt-1 block text-[12px] text-muted">Quote: {visibleNext.quote}</span> : null}
            </>
          ) : (
            "No upcoming exam is saved for the selected courses."
          )}
        </li>
        {preparation ? <li className="text-[13px] leading-[1.55] text-ink">{preparation}</li> : null}
        <li className="text-[13px] leading-[1.55] text-ink">
          {soon.length === 0
            ? "No selected course has an exam in the next 14 days."
            : `Exams in the next 14 days: ${soon.map((exam) => `${exam.courseName} ${exam.title} on ${formatLongDate(exam.date)}`).join("; ")}.`}
        </li>
        {analysis.busyWeeks.length === 0 ? (
          <li className="text-[13px] text-muted">No upcoming week matched a busy-week rule.</li>
        ) : (
          analysis.busyWeeks.map((week) => (
            <li key={week.start} className="text-[13px] text-ink">
              {formatTermRange(week.start, week.end)} · {week.events} events · {week.reasons.join(" · ")}
            </li>
          ))
        )}
        {analysis.overlaps.length === 0 ? null : (
          analysis.overlaps.map((overlap) => (
            <li key={overlap.date} className="text-[13px] text-ink">
              {formatLongDate(overlap.date)} · {overlap.titles.join(" and ")} overlap in time.
            </li>
          ))
        )}
      </ul>
      {analysis.missing.length > 0 ? (
        <div className="mt-4 border-t border-hairline pt-4">
          <h3 className="text-[13px] text-ink">Not on the calendar</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {analysis.missing.map((note) => (
              <li key={note} className="text-[12px] leading-[1.5] text-muted">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

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
