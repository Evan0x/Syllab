import { CalendarDays, LoaderCircle, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { deleteEvent, listEvents, updateEvent } from "../api/events.ts"
import type { StoredEvent } from "../api/events.ts"
import { SyllabusApiError } from "../api/syllabus.ts"
import { Button } from "../components/Button.tsx"
import { AcademicCalendar } from "../components/calendar/AcademicCalendar.tsx"
import type { CalendarItem } from "../components/calendar/AcademicCalendar.tsx"
import { ConfirmDialog } from "../components/ConfirmDialog.tsx"
import { EmptyState } from "../components/EmptyState.tsx"
import { EventEditor } from "../components/EventEditor.tsx"
import type { EventFields } from "../components/EventEditor.tsx"
import { NextSteps } from "../components/NextSteps.tsx"
import { PageHeader } from "../components/PageHeader.tsx"
import { PageShell } from "../components/PageShell.tsx"
import { formatLongDate, formatTimeRange, isoDate, saturdayOfWeek } from "../lib/dates.ts"
import { usePageTitle } from "../lib/pageTitle.ts"

export function SavedCalendarPage({ email, onLogout }: { email: string; onLogout: () => void }) {
  usePageTitle("Calendar · Syllapin")
  const [events, setEvents] = useState<CalendarItem[] | null>(null)
  const [error, setError] = useState<string>()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string>()
  const [actionLoading, setActionLoading] = useState(false)
  const request = useRef(0)

  function load() {
    const token = ++request.current
    setError(undefined)
    setEvents(null)
    void fetchEvents(token)
  }

  async function fetchEvents(token: number) {
    try {
      const loaded = await listEvents()
      if (token === request.current) {
        setEvents(loaded.map(toCalendarItem))
      }
    } catch (caught) {
      if (token === request.current) {
        setEvents([])
        setError(caught instanceof SyllabusApiError ? caught.message : "Could not load the calendar")
      }
    }
  }

  useEffect(() => {
    void fetchEvents(++request.current)
  }, [])

  const editing = events?.find((event) => event.id === editingId)
  const pendingDelete = events?.find((event) => event.id === pendingDeleteId)

  async function saveEdit(fields: EventFields) {
    if (!editing || actionLoading) {
      return
    }
    setActionError(undefined)
    setActionLoading(true)
    try {
      const saved = await updateEvent(editing.id, fields)
      setEvents((current) => (current ?? []).map((event) => (event.id === saved.id ? toCalendarItem(saved) : event)))
      setEditingId(null)
    } catch (caught) {
      setActionError(caught instanceof SyllabusApiError ? caught.message : "Could not save this event")
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || actionLoading) {
      return
    }
    setActionError(undefined)
    setActionLoading(true)
    try {
      await deleteEvent(pendingDelete.id)
      setEvents((current) => (current ?? []).filter((event) => event.id !== pendingDelete.id))
      setPendingDeleteId(null)
    } catch (caught) {
      setPendingDeleteId(null)
      setActionError(caught instanceof SyllabusApiError ? caught.message : "Could not delete this event")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <PageShell email={email} onLogout={onLogout}>
      <PageHeader
        eyebrow="Calendar"
        title="What’s coming up"
        description="Confirmed dates from syllabi you’ve reviewed. This is the schedule Workload and Advisor read."
      >
        <NextSteps
          items={[
            { href: "/upload", label: "Add a course" },
            { href: "/workload", label: "This week’s workload" },
            { href: "/advisor", label: "Ask the advisor" },
          ]}
        />
      </PageHeader>
      {events === null ? (
        <EmptyState
          icon={LoaderCircle}
          tone="loading"
          title="Loading your calendar"
          message="Pulling confirmed dates from the courses you’ve reviewed."
        />
      ) : error ? (
        <EmptyState
          icon={TriangleAlert}
          tone="error"
          title="The calendar couldn’t load"
          message={error}
          action={
            <div className="w-full max-w-xs">
              <Button onClick={load}>Try again</Button>
            </div>
          }
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Add a syllabus to build this calendar"
          message="Upload one PDF, check the extracted dates, then save. After that, this page shows what’s due next."
          action={
            <a href="/upload" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo px-4 text-[13px] font-medium text-white hover:bg-indigo-deep active:bg-indigo-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo">
              <Upload size={17} strokeWidth={1.75} aria-hidden />
              Add a course
            </a>
          }
        />
      ) : (
        <>
          <UpcomingStrip events={events} />
          <AcademicCalendar
            events={events}
            onEdit={(event) => {
              setActionError(undefined)
              setEditingId(event.id)
            }}
            onDelete={(event) => setPendingDeleteId(event.id)}
          />
        </>
      )}
      {actionError ? (
        <p role="alert" className="text-[12px] leading-[1.45] text-error">
          {actionError}
        </p>
      ) : null}
      {editing ? (
        <EventEditor
          heading="Edit event"
          initial={{
            title: editing.title,
            type: editing.type,
            date: editing.date,
            time: editing.time,
            endTime: editing.endTime,
            location: editing.location,
            weightPercent: editing.weightPercent,
          }}
          notice={actionError}
          saving={actionLoading}
          onCancel={() => setEditingId(null)}
          onSave={(fields) => {
            void saveEdit(fields)
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this event?"
          message={`${pendingDelete.title} will be removed from your calendar.`}
          confirmLabel="Delete event"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            void confirmDelete()
          }}
        />
      ) : null}
    </PageShell>
  )
}

function UpcomingStrip({ events }: { events: CalendarItem[] }) {
  const today = isoDate(new Date())
  const weekEnd = saturdayOfWeek(today)
  const upcoming = [...events]
    .filter((event) => event.date && event.date >= today)
    .sort((left, right) => `${left.date}${left.time ?? ""}`.localeCompare(`${right.date}${right.time ?? ""}`))
  const dueThisWeek = upcoming.filter((event) => event.date <= weekEnd)
  const next = upcoming.slice(0, 5)
  const examsSoon = upcoming.filter((event) => event.type?.trim().toUpperCase() === "EXAM").slice(0, 2)

  if (next.length === 0) {
    return (
      <section className="panel px-5 py-4">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">Nothing upcoming</h2>
        <p className="mt-1 text-[13px] leading-5 text-muted">All saved dates are in the past. Add another course, or switch the calendar to past dates.</p>
      </section>
    )
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-1 border-b border-hairline px-5 py-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-[13px] font-medium text-ink">Next up</h2>
        <p className="text-[12px] text-muted">
          {dueThisWeek.length} due through Saturday
          {examsSoon[0] ? ` · Next exam ${examsSoon[0].title} · ${formatLongDate(examsSoon[0].date)}` : ""}
        </p>
      </div>
      <ol>
        {next.map((event) => {
          const time = formatTimeRange(event.time, event.endTime)
          return (
            <li key={event.id} className="flex flex-col gap-1 border-b border-hairline px-5 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] text-ink">{event.title}</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {event.courseName}
                  {event.type ? ` · ${formatType(event.type)}` : ""}
                  {time ? ` · ${time}` : ""}
                </p>
              </div>
              <p className="shrink-0 text-[12px] text-muted">{formatLongDate(event.date)}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function formatType(type: string): string {
  const lower = type.trim().toLowerCase()
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

function toCalendarItem(event: StoredEvent): CalendarItem {
  return {
    id: event.id,
    courseName: event.courseName,
    title: event.title,
    type: event.type,
    date: event.date,
    time: event.time,
    endTime: event.endTime,
    location: event.location,
    weightPercent: event.weightPercent,
    confidence: event.confidence,
    sourceQuote: event.sourceQuote,
  }
}
