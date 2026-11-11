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
import { PageHeader } from "../components/PageHeader.tsx"
import { PageShell } from "../components/PageShell.tsx"
import { usePageTitle } from "../lib/pageTitle.ts"

export function SavedCalendarPage({ email, onLogout }: { email: string; onLogout: () => void }) {
  usePageTitle("Calendar · Syllapin")
  const [events, setEvents] = useState<CalendarItem[] | null>(null)
  const [error, setError] = useState<string>()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string>()
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
    if (!editing) {
      return
    }
    setActionError(undefined)
    try {
      const saved = await updateEvent(editing.id, fields)
      setEvents((current) => (current ?? []).map((event) => (event.id === saved.id ? toCalendarItem(saved) : event)))
      setEditingId(null)
    } catch (caught) {
      setActionError(caught instanceof SyllabusApiError ? caught.message : "Could not save this event")
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return
    }
    setActionError(undefined)
    try {
      await deleteEvent(pendingDelete.id)
      setEvents((current) => (current ?? []).filter((event) => event.id !== pendingDelete.id))
      setPendingDeleteId(null)
    } catch (caught) {
      setPendingDeleteId(null)
      setActionError(caught instanceof SyllabusApiError ? caught.message : "Could not delete this event")
    }
  }

  return (
    <PageShell email={email} onLogout={onLogout}>
      <PageHeader
        eyebrow="Calendar"
        title="Your saved dates"
        description="Confirmed events from syllabi you have reviewed. Edit anything that needs a second look."
      />
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
          title="No saved events yet"
          message="Review a syllabus and open its calendar view to keep the dates here."
          action={
            <a href="/" className="inline-flex">
              <span className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo px-4 text-[13px] font-medium text-white hover:bg-indigo-deep">
                <Upload size={17} strokeWidth={1.75} aria-hidden />
                Upload a syllabus
              </span>
            </a>
          }
        />
      ) : (
        <AcademicCalendar
          events={events}
          onEdit={(event) => {
            setActionError(undefined)
            setEditingId(event.id)
          }}
          onDelete={(event) => setPendingDeleteId(event.id)}
        />
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
