import { ArrowLeft, Download, LoaderCircle, Plus, TriangleAlert } from "lucide-react"
import { useRef, useState } from "react"
import { saveReviewedCalendar } from "../api/events.ts"
import { downloadBlob, exportCalendar, isAbortError, SyllabusApiError } from "../api/syllabus.ts"
import type { CalendarEvent, PreviewResponse } from "../api/syllabus.ts"
import { Button } from "../components/Button.tsx"
import { AcademicCalendar } from "../components/calendar/AcademicCalendar.tsx"
import type { CalendarItem } from "../components/calendar/AcademicCalendar.tsx"
import { ConfirmDialog } from "../components/ConfirmDialog.tsx"
import { EmptyState } from "../components/EmptyState.tsx"
import { EventEditor } from "../components/EventEditor.tsx"
import type { EventFields } from "../components/EventEditor.tsx"
import { PageHeader } from "../components/PageHeader.tsx"
import { PageShell } from "../components/PageShell.tsx"
import {
  formatLongDate,
  formatMonthDay,
  formatMonthHeading,
  formatTermRange,
  formatTimeRange,
  formatWeekday,
} from "../lib/dates.ts"
import { usePageTitle } from "../lib/pageTitle.ts"

type ReviewTerm = {
  termStart: string
  termEnd: string
}

type ReviewCalendarPageProps = {
  preview: PreviewResponse | null
  term: ReviewTerm | null
  email: string
  onLogout: () => void
  onBack: () => void
}

type ReviewEvent = CalendarEvent & {
  id: string
}

type EventGroup = {
  key: string
  label: string
  events: ReviewEvent[]
}

const MISSING = "Not specified"

export function ReviewCalendarPage({ preview, term, email, onLogout, onBack }: ReviewCalendarPageProps) {
  usePageTitle(`${preview?.courseName || "Calendar"} · Syllapin`)
  const [events, setEvents] = useState<ReviewEvent[]>(() => (preview?.events ?? []).map(withId))
  const [courseId] = useState(() => crypto.randomUUID())
  const [showCalendar, setShowCalendar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const [editor, setEditor] = useState<"add" | string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string>()
  const [exported, setExported] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportingRef = useRef(false)
  const calendarOpened = useRef(false)
  const saveSeq = useRef(0)
  const groups = groupEvents(events)
  const [chosenMonth, setChosenMonth] = useState(groups[0]?.key ?? "")
  const activeMonth = groups.some((group) => group.key === chosenMonth)
    ? chosenMonth
    : (groups[0]?.key ?? "")
  const semester = term?.termStart && term.termEnd ? formatTermRange(term.termStart, term.termEnd) : null
  const editing = editor && editor !== "add" ? events.find((event) => event.id === editor) : undefined
  const pendingDelete = events.find((event) => event.id === pendingDeleteId)

  function showMonth(key: string) {
    setChosenMonth(key)
    document.getElementById(`review-month-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function saveEvent(fields: EventFields) {
    const next =
      editor === "add"
        ? [...events, { ...fields, id: crypto.randomUUID(), confidence: null, sourceQuote: null }]
        : editing
          ? events.map((event) =>
              event.id === editing.id
                ? { ...event, ...fields, confidence: event.confidence, sourceQuote: event.sourceQuote }
                : event,
            )
          : events
    setEvents(next)
    setEditor(null)
    if (calendarOpened.current) {
      void persist(next)
    }
  }

  function confirmDelete() {
    if (!pendingDeleteId) {
      return
    }
    const next = events.filter((event) => event.id !== pendingDeleteId)
    setEvents(next)
    setPendingDeleteId(null)
    if (calendarOpened.current) {
      void persist(next)
    }
  }

  function openCalendar() {
    calendarOpened.current = true
    setShowCalendar(true)
    void persist(events)
  }

  async function persist(next: ReviewEvent[]) {
    if (!preview) {
      return
    }
    const token = ++saveSeq.current
    setSaving(true)
    try {
      await saveReviewedCalendar({
        courseId,
        courseName: preview.courseName.trim() || "Course",
        termStart: term?.termStart || null,
        termEnd: term?.termEnd || null,
        events: next.filter((event) => event.date && event.title?.trim()).map(toWriteEvent),
      })
      if (token === saveSeq.current) {
        setSaveError(undefined)
        setSaved(true)
      }
    } catch (error) {
      if (token === saveSeq.current) {
        setSaveError(error instanceof SyllabusApiError ? error.message : "Could not save the calendar")
      }
    } finally {
      if (token === saveSeq.current) {
        setSaving(false)
      }
    }
  }

  async function exportIcs() {
    if (exportingRef.current || !preview) {
      return
    }
    const missing = events.find((event) => !event.title?.trim() || !event.date)
    if (missing) {
      setExportError("Every event needs a title and a date before it can be exported.")
      return
    }
    exportingRef.current = true
    setExporting(true)
    setExportError(undefined)
    try {
      const result = await exportCalendar({ courseName: preview.courseName, events })
      downloadBlob(result.blob, result.filename)
      setExported(true)
    } catch (error) {
      if (!isAbortError(error)) {
        setExportError(
          error instanceof SyllabusApiError ? error.message : "Could not export the calendar",
        )
      }
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  return (
    <PageShell email={email} onLogout={onLogout} onHome={onBack}>
          <PageHeader
            eyebrow="Review"
            title={preview?.courseName || "Calendar preview"}
            description={semester ? `${semester}. Check anything that looks uncertain before you save or export.` : "Check anything that looks uncertain before you save or export."}
          >
            {preview ? <EventStats events={events} /> : null}
          </PageHeader>

          {!preview ? (
            <EmptyState
              icon={TriangleAlert}
              tone="error"
              title="We couldn’t show this calendar"
              message="Go back and upload the syllabus again."
              action={
                <div className="w-full max-w-xs">
                  <Button icon={ArrowLeft} onClick={onBack}>
                    Back to upload
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="segmented" role="tablist" aria-label="Review view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!showCalendar}
                    onClick={() => setShowCalendar(false)}
                  >
                    Review list
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={showCalendar}
                    onClick={openCalendar}
                  >
                    Calendar
                  </button>
                </div>
                <p className={`text-[12px] ${saveError ? "text-error" : "text-muted"}`} role={saveError ? "alert" : "status"} aria-live="polite">
                  {saving
                    ? "Saving to your calendar…"
                    : saveError
                      ? saveError
                      : saved
                        ? "Saved to your calendar"
                        : "Open calendar view to keep these dates on Syllapin."}
                </p>
              </div>
              {showCalendar ? (
                <AcademicCalendar
                  events={events.filter((event) => event.date && event.title?.trim()).map((event) => toCalendarItem(event, preview.courseName))}
                  onEdit={(event) => setEditor(event.id)}
                  onDelete={(event) => setPendingDeleteId(event.id)}
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
                        className={`shrink-0 rounded-md border px-3 py-1.5 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
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

              <div className="panel overflow-hidden">
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
                {events.length === 0 ? (
                  <p className="p-6 text-[13px] leading-[1.6] text-muted lg:p-8">
                    No events yet. Add the dates you still need, then export.
                  </p>
                ) : (
                  groups.map((group) => (
                    <section
                      key={group.key}
                      id={`review-month-${group.key}`}
                      aria-label={group.label}
                      className="scroll-mt-28"
                    >
                      <h2 className="border-b border-hairline px-5 py-3 text-[13px] font-medium tracking-[-0.1px] text-ink lg:px-8">
                        {group.label}
                      </h2>
                      <ol>
                        {group.events.map((event) => (
                          <EventRow
                            key={event.id}
                            event={event}
                            onEdit={() => setEditor(event.id)}
                            onDelete={() => setPendingDeleteId(event.id)}
                          />
                        ))}
                      </ol>
                    </section>
                  ))
                )}
              </div>
              </>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button icon={Plus} variant="secondary" onClick={() => setEditor("add")}>
                  Add event
                </Button>
                <Button
                  icon={exporting ? LoaderCircle : Download}
                  disabled={exporting}
                  spinIcon={exporting}
                  onClick={() => void exportIcs()}
                >
                  {exporting ? "Exporting calendar…" : "Export .ics file"}
                </Button>
              </div>
              {exportError ? (
                <p role="alert" className="text-[12px] leading-[1.45] text-error">
                  {exportError}
                </p>
              ) : exported ? (
                <p role="status" className="text-[12px] leading-[1.45] text-success">
                  Calendar downloaded. Import the .ics file into Google Calendar, Apple Calendar, or Outlook.
                </p>
              ) : null}
            </>
          )}

          <button
            type="button"
            onClick={onBack}
            className="w-fit text-[13px] font-medium text-indigo hover:text-indigo-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Upload another syllabus
          </button>
      {editor === "add" ? (
        <EventEditor
          heading="Add event"
          initial={emptyFields()}
          onCancel={() => setEditor(null)}
          onSave={saveEvent}
        />
      ) : null}
      {editing ? (
        <EventEditor
          heading="Edit event"
          initial={fieldsFromEvent(editing)}
          onCancel={() => setEditor(null)}
          onSave={saveEvent}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this event?"
          message={`${pendingDelete.title?.trim() || "Untitled event"} will be removed from this review and from the saved calendar.`}
          confirmLabel="Delete event"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </PageShell>
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
          <dt className="text-[11px] font-medium text-muted">{label}</dt>
          <dd className="mt-0.5 text-[16px] font-medium tabular-nums tracking-[-0.02em] text-ink">{count}</dd>
        </div>
      ))}
    </dl>
  )
}

function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: ReviewEvent
  onEdit: () => void
  onDelete: () => void
}) {
  const dated = event.date ? formatMonthDay(event.date) : null
  const time = formatTimeRange(event.time, event.endTime)
  const quote = event.sourceQuote
  const showQuote = quote != null && quote.trim() !== ""

  return (
    <li
      className={`flex flex-col gap-3 border-b border-hairline px-5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-6 lg:px-8 lg:py-5 ${
        event.confidence?.trim().toUpperCase() === "LOW" ? "border-l-2 border-l-error bg-error-soft/40" : ""
      }`}
    >
      <div className="flex w-14 shrink-0 flex-col">
        {dated && event.date ? (
          <>
            <span className="text-[11px] font-semibold tracking-[0.8px] text-indigo">
              {formatWeekday(event.date)}
            </span>
            <span className="text-[15px] leading-none font-medium tracking-[-0.02em] text-ink">{dated.day}</span>
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
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${typeClass(event.type)}`}>
              {event.type?.trim() ? formatType(event.type) : MISSING}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${confidenceClass(event.confidence)}`}>
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
        {showQuote ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">Show syllabus quote</summary>
            <p className="mt-2 border-l-2 border-indigo-line pl-3 text-[12px] leading-[1.55] text-muted">{quote}</p>
          </details>
        ) : null}
        <div className="mt-3 flex gap-4">
          <button
            type="button"
            onClick={onEdit}
            className="text-[12px] text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-[12px] text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}

function toCalendarItem(event: ReviewEvent, courseName: string): CalendarItem {
  return {
    id: event.id,
    courseName,
    title: event.title?.trim() || "Untitled event",
    type: event.type,
    date: event.date ?? "",
    time: event.time,
    endTime: event.endTime,
    location: event.location,
    weightPercent: event.weightPercent,
    confidence: event.confidence,
    sourceQuote: event.sourceQuote,
  }
}

function toWriteEvent(event: ReviewEvent) {
  return {
    id: event.id,
    title: event.title?.trim() || "",
    type: event.type,
    date: event.date ?? "",
    time: event.time,
    endTime: event.endTime,
    location: event.location,
    weightPercent: event.weightPercent,
    confidence: event.confidence,
    sourceQuote: event.sourceQuote,
  }
}

function emptyFields(): EventFields {
  return {
    title: "",
    type: null,
    date: "",
    time: null,
    endTime: null,
    location: null,
    weightPercent: null,
  }
}

function fieldsFromEvent(event: ReviewEvent): EventFields {
  return {
    title: event.title ?? "",
    type: event.type,
    date: event.date ?? "",
    time: event.time,
    endTime: event.endTime,
    location: event.location,
    weightPercent: event.weightPercent,
  }
}

function withId(event: CalendarEvent): ReviewEvent {
  return { ...event, id: crypto.randomUUID() }
}

function Detail({ label, value }: { label: string; value: string | null }) {
  const specified = Boolean(value)
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-muted">{label}</dt>
      <dd className={`mt-0.5 text-[13px] leading-[1.4] break-words ${specified ? "text-ink" : "text-placeholder"}`}>
        {value ?? MISSING}
      </dd>
    </div>
  )
}

function groupEvents(events: ReviewEvent[]): EventGroup[] {
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
  if (value === "ASSIGNMENT" || value === "PROJECT") {
    return "bg-well text-ink"
  }
  if (value === "ADMIN") {
    return "bg-indigo-soft text-indigo"
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
