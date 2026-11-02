import { ArrowLeft, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { Button } from "../components/Button.tsx"
import { SiteFooter } from "../components/SiteFooter.tsx"
import { SiteHeader } from "../components/SiteHeader.tsx"
import {
  formatLongDate,
  formatMonthDay,
  formatMonthHeading,
  formatTermRange,
  formatTimeRange,
  formatWeekday,
} from "../lib/dates.ts"
import type { CalendarEvent, PreviewResponse } from "../api/syllabus.ts"

type ReviewTerm = {
  termStart: string
  termEnd: string
}

type ReviewCalendarPageProps = {
  preview: PreviewResponse | null
  term: ReviewTerm | null
  onBack: () => void
}

type EventGroup = {
  key: string
  label: string
  events: CalendarEvent[]
}

const MISSING = "Not specified"

export function ReviewCalendarPage({ preview, term, onBack }: ReviewCalendarPageProps) {
  const events = preview?.events ?? []
  const groups = groupEvents(events)
  const [activeMonth, setActiveMonth] = useState(groups[0]?.key ?? "")
  const semester = term?.termStart && term.termEnd ? formatTermRange(term.termStart, term.termEnd) : null

  function showMonth(key: string) {
    setActiveMonth(key)
    document.getElementById(`review-month-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="bg-canvas text-ink">
      <SiteHeader onHome={onBack} />
      <main className="px-6 pt-9 pb-16 lg:px-10 lg:pt-[53px] xl:px-20">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
          <header className="flex flex-col items-start gap-4">
            <p className="text-[10px] font-semibold tracking-[1.2px] text-indigo lg:text-[11px] lg:tracking-[1.7px]">
              REVIEW YOUR CALENDAR
            </p>
            <div className="flex flex-col gap-2">
              <h1 className="font-serif text-[49px] leading-[1.06] italic tracking-[-1.4px] text-ink lg:text-[68px] lg:leading-[1.1] lg:tracking-[-2px]">
                {preview?.courseName || "Calendar preview"}
              </h1>
              <p className="text-[15px] leading-[1.5] text-muted lg:text-[16px]">
                {semester ?? MISSING}
              </p>
            </div>
            {preview ? <EventStats events={events} /> : null}
          </header>

          {!preview ? (
            <StatusCard
              title="We couldn’t show this calendar"
              message="Go back and upload the syllabus again."
              tone="error"
              onBack={onBack}
            />
          ) : events.length === 0 ? (
            <StatusCard
              title="No events found"
              message="Nothing in this syllabus was returned as an assignment, quiz, or exam."
              onBack={onBack}
            />
          ) : (
            <>
              {groups.length > 1 ? (
                <nav aria-label="Months" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {groups.map((group) => {
                    const selected = group.key === activeMonth
                    return (
                      <button
                        key={group.key}
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => showMonth(group.key)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
                          selected
                            ? "border-indigo bg-indigo-soft text-indigo"
                            : "border-hairline bg-surface text-ink hover:border-indigo-line"
                        }`}
                      >
                        {group.label}
                      </button>
                    )
                  })}
                </nav>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_8px_32px_rgba(39,35,62,0.03)]">
                {preview.warnings.length > 0 ? (
                  <div className="border-b border-hairline bg-error-soft px-5 py-4 lg:px-8">
                    <p className="flex items-center gap-2 text-[13px] text-error">
                      <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
                      Check these before you rely on the dates
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-[12px] leading-[1.6] text-ink">
                      {preview.warnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {groups.map((group) => (
                  <section
                    key={group.key}
                    id={`review-month-${group.key}`}
                    aria-label={group.label}
                    className="scroll-mt-6"
                  >
                    <h2 className="border-b border-hairline px-5 py-3 text-[13px] font-medium tracking-[-0.1px] text-ink lg:px-8">
                      {group.label}
                    </h2>
                    <ol>
                      {group.events.map((event, index) => (
                        <EventRow
                          key={`${group.key}-${event.title ?? "event"}-${event.date ?? "date"}-${index}`}
                          event={event}
                        />
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onBack}
            className="w-fit text-[12px] text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Upload another PDF
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function EventStats({ events }: { events: CalendarEvent[] }) {
  const stats = [
    ["Events", events.length],
    ["Exams", countType(events, "EXAM")],
    ["Quizzes", countType(events, "QUIZ")],
    ["Assignments", countType(events, "ASSIGNMENT")],
  ] as const

  return (
    <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      {stats.map(([label, count]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] font-semibold tracking-[0.8px] text-muted uppercase">{label}</dt>
          <dd className="mt-0.5 text-[18px] tracking-[-0.3px] text-ink">{count}</dd>
        </div>
      ))}
    </dl>
  )
}

function StatusCard({
  title,
  message,
  onBack,
  tone = "empty",
}: {
  title: string
  message: string
  onBack: () => void
  tone?: "empty" | "error"
}) {
  return (
    <div
      className="flex flex-col gap-5 rounded-2xl border border-hairline bg-surface p-6 shadow-[0_8px_32px_rgba(39,35,62,0.03)] lg:p-8"
      role={tone === "error" ? "alert" : "status"}
    >
      <h2 className="text-[18px] text-ink">{title}</h2>
      <p className="text-[13px] leading-[1.6] text-muted">{message}</p>
      <Button icon={ArrowLeft} onClick={onBack}>
        Back to upload
      </Button>
    </div>
  )
}

function EventRow({ event }: { event: CalendarEvent }) {
  const dated = event.date ? formatMonthDay(event.date) : null
  const time = formatTimeRange(event.time, event.endTime)
  const quote = event.sourceQuote

  return (
    <li className="flex flex-col gap-3 border-b border-hairline px-5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-6 lg:px-8 lg:py-5">
      <div className="flex w-14 shrink-0 flex-col">
        {dated && event.date ? (
          <>
            <span className="text-[11px] font-semibold tracking-[0.8px] text-indigo">
              {formatWeekday(event.date)}
            </span>
            <span className="text-[22px] leading-none tracking-[-0.4px] text-ink">{dated.day}</span>
            <span className="mt-1 text-[12px] text-muted">{dated.month}</span>
          </>
        ) : (
          <span className="text-[12px] leading-[1.4] text-placeholder">{MISSING}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h3 className="max-w-full text-[16px] leading-snug tracking-[-0.2px] break-words text-ink">
            {event.title?.trim() || "Untitled event"}
          </h3>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${typeClass(event.type)}`}>
              {event.type?.trim() ? formatType(event.type) : MISSING}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${confidenceClass(event.confidence)}`}>
              {confidenceLabel(event.confidence)}
            </span>
          </div>
        </div>
        <p className={`mt-1 text-[12px] ${event.date ? "text-muted" : "text-placeholder"}`}>
          {event.date ? formatLongDate(event.date) : MISSING}
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Detail label="Time" value={time} />
          <Detail label="Location" value={event.location?.trim() || null} />
          <Detail label="Weight" value={formatWeight(event.weightPercent)} />
        </dl>
        {quote ? (
          <blockquote className="mt-3 border-l-2 border-indigo-line pl-3 text-[12px] leading-[1.55] text-muted italic">
            {quote}
          </blockquote>
        ) : null}
      </div>
    </li>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  const specified = Boolean(value)
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-[0.8px] text-muted uppercase">{label}</dt>
      <dd className={`mt-0.5 text-[13px] leading-[1.4] break-words ${specified ? "text-ink" : "text-placeholder"}`}>
        {value ?? MISSING}
      </dd>
    </div>
  )
}

function groupEvents(events: CalendarEvent[]): EventGroup[] {
  const sorted = [...events].sort((left, right) => eventKey(left).localeCompare(eventKey(right)))
  const groups: EventGroup[] = []
  for (const event of sorted) {
    const key = event.date ? event.date.slice(0, 7) : "undated"
    const label = event.date ? formatMonthHeading(event.date) : "No date"
    const current = groups[groups.length - 1]
    if (current?.key === key) {
      current.events.push(event)
    } else {
      groups.push({ key, label, events: [event] })
    }
  }
  return groups
}

function eventKey(event: CalendarEvent): string {
  return `${event.date ?? "9999-99-99"}T${event.time ?? "99:99:99"}`
}

function countType(events: CalendarEvent[], type: string): number {
  return events.filter((event) => event.type?.trim().toUpperCase() === type).length
}

function formatType(type: string): string {
  const lower = type.trim().toLowerCase()
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

function typeClass(type: string | null): string {
  const value = type?.trim().toUpperCase()
  if (value === "EXAM") {
    return "bg-error-soft text-error"
  }
  if (value === "QUIZ") {
    return "bg-indigo-soft text-indigo"
  }
  if (value === "ASSIGNMENT") {
    return "bg-well text-ink"
  }
  return "bg-well text-placeholder"
}

function confidenceLabel(value: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return MISSING
  }
  const level = trimmed.toUpperCase()
  if (level === "HIGH" || level === "MEDIUM" || level === "LOW") {
    return `${level.charAt(0)}${level.slice(1).toLowerCase()}`
  }
  return trimmed
}

function confidenceClass(value: string | null): string {
  const level = value?.trim().toUpperCase()
  if (level === "HIGH") {
    return "bg-success-soft text-success"
  }
  if (level === "MEDIUM") {
    return "bg-indigo-soft text-indigo"
  }
  if (level === "LOW") {
    return "bg-error-soft text-error"
  }
  return "bg-well text-placeholder"
}

function formatWeight(value: number | null): string | null {
  if (value === null) {
    return null
  }
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `${amount}%`
}
