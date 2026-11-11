import { useEffect, useRef, useState } from "react"
import { deleteEvent, listEvents, updateEvent } from "../api/events.ts"
import type { StoredEvent } from "../api/events.ts"
import { SyllabusApiError } from "../api/syllabus.ts"
import { AcademicCalendar } from "../components/calendar/AcademicCalendar.tsx"
import type { CalendarItem } from "../components/calendar/AcademicCalendar.tsx"
import { EventEditor } from "../components/EventEditor.tsx"
import type { EventFields } from "../components/EventEditor.tsx"
import { SiteFooter } from "../components/SiteFooter.tsx"
import { SiteHeader } from "../components/SiteHeader.tsx"

export function SavedCalendarPage({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [events, setEvents] = useState<CalendarItem[] | null>(null)
  const [error, setError] = useState<string>()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string>()
  const request = useRef(0)

  useEffect(() => {
    const token = ++request.current
    listEvents()
      .then((loaded) => {
        if (token === request.current) {
          setEvents(loaded.map(toCalendarItem))
          setError(undefined)
        }
      })
      .catch((caught) => {
        if (token === request.current) {
          setEvents([])
          setError(caught instanceof SyllabusApiError ? caught.message : "Could not load the calendar")
        }
      })
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
    <div className="bg-canvas text-ink">
      <SiteHeader email={email} onLogout={onLogout} />
      <main className="px-6 pt-9 pb-16 lg:px-10 lg:pt-[53px] xl:px-20">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
          <header className="flex flex-col items-start gap-4">
            <p className="text-[10px] font-semibold tracking-[1.2px] text-indigo lg:text-[11px] lg:tracking-[1.7px]">
              YOUR CALENDAR
            </p>
            <div className="flex flex-col gap-2">
              <h1 className="font-serif text-[49px] leading-[1.06] italic tracking-[-1.4px] text-ink lg:text-[68px] lg:leading-[1.1] lg:tracking-[-2px]">
                Saved events
              </h1>
              <p className="text-[15px] leading-[1.5] text-muted lg:text-[16px]">
                Confirmed dates from the syllabi you have reviewed.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href="/workload"
                className="text-[12px] text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
              >
                See workload
              </a>
              <a
                href="/"
                className="text-[12px] text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
              >
                Upload a syllabus
              </a>
            </div>
          </header>
          {events === null ? (
            <p className="rounded-2xl border border-hairline bg-surface px-5 py-8 text-[13px] text-muted">Loading your calendar…</p>
          ) : error ? (
            <p role="alert" className="rounded-2xl border border-hairline bg-error-soft px-5 py-8 text-[13px] text-error">
              {error}
            </p>
          ) : events.length === 0 ? (
            <p className="rounded-2xl border border-hairline bg-surface px-5 py-8 text-[13px] leading-[1.6] text-muted">
              No saved events yet. Review a syllabus and open its calendar to keep the dates here.
            </p>
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
        </div>
      </main>
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
        <ConfirmDelete
          title={pendingDelete.title}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            void confirmDelete()
          }}
        />
      ) : null}
      <SiteFooter />
    </div>
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

function ConfirmDelete({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="review-dialog w-full max-w-[420px]"
      aria-labelledby="saved-delete-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5 shadow-[0_8px_32px_rgba(39,35,62,0.08)] sm:p-6">
        <h2 id="saved-delete-title" className="text-[18px] tracking-[-0.3px] text-ink">
          Delete this event?
        </h2>
        <p className="text-[13px] leading-[1.6] text-muted">{title} will be removed from your calendar.</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-lg px-4 text-[14px] text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-12 rounded-lg bg-error px-5 text-[14px] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Delete event
          </button>
        </div>
      </div>
    </dialog>
  )
}
