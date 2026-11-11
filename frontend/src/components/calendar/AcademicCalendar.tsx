import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import {
  addDays,
  formatClock,
  formatLongDate,
  formatMonthHeading,
  formatTimeRange,
  formatWeekday,
  isoDate,
  parseIsoDate,
} from "../../lib/dates.ts"

export type CalendarItem = {
  id: string
  courseName: string
  title: string
  type: string | null
  date: string
  time: string | null
  endTime: string | null
  location: string | null
  weightPercent: number | null
  confidence: string | null
  sourceQuote: string | null
}

type CalendarView = "month" | "week" | "agenda"
type WhenFilter = "all" | "upcoming" | "past"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_LIMIT = 2

export function AcademicCalendar({
  events,
  onEdit,
  onDelete,
}: {
  events: CalendarItem[]
  onEdit: (event: CalendarItem) => void
  onDelete: (event: CalendarItem) => void
}) {
  const today = isoDate(new Date())
  const [view, setView] = useState<CalendarView>("month")
  const [cursor, setCursor] = useState(() => firstDated(events) ?? parseIsoDate(today))
  const [course, setCourse] = useState("all")
  const [type, setType] = useState("all")
  const [when, setWhen] = useState<WhenFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)

  const courses = unique(events.map((event) => event.courseName).filter(Boolean))
  const types = unique(events.map((event) => event.type?.trim().toUpperCase()).filter((value): value is string => Boolean(value)))
  const filtered = events.filter((event) => {
    if (course !== "all" && event.courseName !== course) {
      return false
    }
    if (type !== "all" && event.type?.trim().toUpperCase() !== type) {
      return false
    }
    if (when === "upcoming" && event.date < today) {
      return false
    }
    if (when === "past" && event.date >= today) {
      return false
    }
    return true
  })
  const byDay = useMemo(() => groupByDate(filtered), [filtered])
  const selected = filtered.find((event) => event.id === selectedId) ?? null
  const dayEvents = openDay ? (byDay.get(openDay) ?? []) : []
  const filtersActive = course !== "all" || type !== "all" || when !== "all"

  function clearFilters() {
    setCourse("all")
    setType("all")
    setWhen("all")
  }

  function showEvent(event: CalendarItem) {
    setSelectedId(event.id)
    setOpenDay(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex rounded-full border border-hairline bg-surface p-1" role="tablist" aria-label="Calendar view">
          {(["month", "week", "agenda"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={view === option}
              onClick={() => setView(option)}
              className={`rounded-full px-3 py-1.5 text-[12px] capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
                view === option ? "bg-indigo text-white" : "text-muted hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {view !== "agenda" ? (
          <div className="flex items-center gap-2">
            <NavButton label={view === "month" ? "Previous month" : "Previous week"} onClick={() => setCursor(shift(cursor, view, -1))} />
            <p className="min-w-36 text-center text-[14px] text-ink">{formatMonthHeading(isoDate(cursor))}</p>
            <NavButton label={view === "month" ? "Next month" : "Next week"} forward onClick={() => setCursor(shift(cursor, view, 1))} />
            <button
              type="button"
              onClick={() => setCursor(parseIsoDate(today))}
              className="rounded-full border border-hairline px-3 py-1.5 text-[12px] text-ink hover:border-indigo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              Today
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <Filter label="Course" value={course} onChange={setCourse} options={[["all", "All courses"], ...courses.map((name) => [name, name] as [string, string])]} />
        <Filter label="Type" value={type} onChange={setType} options={[["all", "All types"], ...types.map((value) => [value, formatType(value)] as [string, string])]} />
        <Filter
          label="When"
          value={when}
          onChange={(value) => setWhen(value as WhenFilter)}
          options={[
            ["all", "All dates"],
            ["upcoming", "Upcoming"],
            ["past", "Past"],
          ]}
        />
        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="h-10 text-[12px] text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-hairline bg-surface px-5 py-8 text-[13px] leading-[1.6] text-muted">
              No events match these filters.
            </p>
          ) : view === "month" ? (
            <MonthView
              cursor={cursor}
              today={today}
              byDay={byDay}
              onShowDay={(iso) => {
                setOpenDay(iso)
                setSelectedId(null)
              }}
              onShowEvent={showEvent}
            />
          ) : view === "week" ? (
            <WeekView cursor={cursor} today={today} byDay={byDay} onShowEvent={showEvent} />
          ) : (
            <AgendaView events={filtered} today={today} onShowEvent={showEvent} />
          )}
        </div>
        <aside className="rounded-2xl border border-hairline bg-surface p-5 shadow-[0_8px_32px_rgba(39,35,62,0.03)]">
          {selected ? (
            <EventDetail event={selected} onEdit={() => onEdit(selected)} onDelete={() => onDelete(selected)} onClose={() => setSelectedId(null)} />
          ) : openDay ? (
            <DayList iso={openDay} events={dayEvents} onShowEvent={showEvent} onClose={() => setOpenDay(null)} />
          ) : (
            <p className="text-[13px] leading-[1.6] text-muted">Select an event to see its course, date, weight, and source quote.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function MonthView({
  cursor,
  today,
  byDay,
  onShowDay,
  onShowEvent,
}: {
  cursor: Date
  today: string
  byDay: Map<string, CalendarItem[]>
  onShowDay: (iso: string) => void
  onShowEvent: (event: CalendarItem) => void
}) {
  const cells = monthCells(cursor)
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div className="grid grid-cols-7 border-b border-hairline">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold tracking-[0.6px] text-muted uppercase">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const iso = isoDate(date)
          const inMonth = date.getMonth() === cursor.getMonth()
          const items = byDay.get(iso) ?? []
          const hidden = Math.max(0, items.length - DAY_LIMIT)
          return (
            <div
              key={iso}
              className={`min-h-24 border-t border-r border-hairline p-1.5 last:border-r-0 sm:min-h-28 sm:p-2 [&:nth-child(7n)]:border-r-0 ${
                inMonth ? "bg-surface" : "bg-canvas"
              } ${iso === today ? "ring-1 ring-indigo ring-inset" : ""}`}
            >
              <p className={`text-[12px] ${iso === today ? "font-semibold text-indigo" : inMonth ? "text-ink" : "text-placeholder"}`}>
                {date.getDate()}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {items.slice(0, DAY_LIMIT).map((event) => (
                  <li key={event.id}>
                    <EventChip event={event} onClick={() => onShowEvent(event)} />
                  </li>
                ))}
              </ul>
              {hidden > 0 ? (
                <button
                  type="button"
                  onClick={() => onShowDay(iso)}
                  className="mt-1 text-[11px] text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
                >
                  +{hidden} more
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  cursor,
  today,
  byDay,
  onShowEvent,
}: {
  cursor: Date
  today: string
  byDay: Map<string, CalendarItem[]>
  onShowEvent: (event: CalendarItem) => void
}) {
  const start = weekStart(cursor)
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
      <div className="grid min-w-[720px] grid-cols-7">
        {days.map((date) => {
          const iso = isoDate(date)
          const items = [...(byDay.get(iso) ?? [])].sort(byTime)
          return (
            <section key={iso} className="border-r border-hairline p-2 last:border-r-0">
              <h3 className={`text-[12px] ${iso === today ? "font-semibold text-indigo" : "text-ink"}`}>
                <span className="block text-[10px] tracking-[0.6px] text-muted uppercase">{formatWeekday(iso)}</span>
                {date.getDate()}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {items.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => onShowEvent(event)}
                      className="w-full rounded-lg border border-hairline px-2 py-2 text-left hover:border-indigo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
                    >
                      <span className={`mb-1 inline-block h-1.5 w-1.5 rounded-full ${dotClass(event.type)}`} />
                      <span className="block text-[12px] leading-snug text-ink">{event.title}</span>
                      <span className="mt-1 block text-[11px] text-muted">{formatTimeRange(event.time, event.endTime) ?? "All day"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function AgendaView({
  events,
  today,
  onShowEvent,
}: {
  events: CalendarItem[]
  today: string
  onShowEvent: (event: CalendarItem) => void
}) {
  const groups = groupAgenda(events)
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      {groups.map((group) => (
        <section key={group.date}>
          <h3 className={`border-b border-hairline px-4 py-3 text-[13px] ${group.date === today ? "text-indigo" : "text-ink"}`}>
            {formatLongDate(group.date)}
            <span className="ml-2 text-[11px] tracking-[0.6px] text-muted uppercase">{formatWeekday(group.date)}</span>
          </h3>
          <ul>
            {group.events.map((event) => (
              <li key={event.id} className="border-b border-hairline last:border-b-0">
                <button
                  type="button"
                  onClick={() => onShowEvent(event)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="block text-[14px] text-ink">{event.title}</span>
                    <span className="mt-0.5 block text-[12px] text-muted">
                      {event.courseName || "Course"} · {formatType(event.type)} · {formatTimeRange(event.time, event.endTime) ?? formatLongDate(event.date)}
                    </span>
                  </span>
                  <span className="text-[12px] text-muted">{formatWeight(event.weightPercent) ?? "No weight"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EventDetail({
  event,
  onEdit,
  onDelete,
  onClose,
}: {
  event: CalendarItem
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const quote = event.sourceQuote?.trim()
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.8px] text-muted uppercase">{event.courseName || "Course"}</p>
        <button type="button" onClick={onClose} className="text-[12px] text-muted hover:text-ink">
          Close
        </button>
      </div>
      <h2 className="mt-2 text-[18px] leading-snug tracking-[-0.3px] text-ink">{event.title}</h2>
      <dl className="mt-4 flex flex-col gap-3">
        <Detail label="Deadline" value={formatLongDate(event.date)} />
        <Detail label="Type" value={formatType(event.type)} />
        <Detail label="Time" value={formatTimeRange(event.time, event.endTime)} />
        <Detail label="Weight" value={formatWeight(event.weightPercent)} />
        <Detail label="Location" value={event.location} />
      </dl>
      {quote ? (
        <div className="mt-4">
          <p className="text-[10px] font-semibold tracking-[0.8px] text-muted uppercase">Source quote</p>
          <p className="mt-1 border-l-2 border-indigo-line pl-3 text-[12px] leading-[1.55] text-muted">{quote}</p>
        </div>
      ) : null}
      <div className="mt-5 flex gap-4">
        <button type="button" onClick={onEdit} className="text-[12px] text-indigo">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="text-[12px] text-error">
          Delete
        </button>
      </div>
    </div>
  )
}

function DayList({
  iso,
  events,
  onShowEvent,
  onClose,
}: {
  iso: string
  events: CalendarItem[]
  onShowEvent: (event: CalendarItem) => void
  onClose: () => void
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[16px] text-ink">{formatLongDate(iso)}</h2>
        <button type="button" onClick={onClose} className="text-[12px] text-muted hover:text-ink">
          Close
        </button>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {events.map((event) => (
          <li key={event.id}>
            <EventChip event={event} onClick={() => onShowEvent(event)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function EventChip({ event, onClick }: { event: CalendarItem; onClick: () => void }) {
  const time = event.time ? formatClock(event.time) : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo ${chipClass(event.type)}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(event.type)}`} />
      <span className="truncate">{time ? `${time} ${event.title}` : event.title}</span>
    </button>
  )
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <label className="flex min-w-36 flex-col gap-1 text-[10px] font-semibold tracking-[0.6px] text-muted uppercase">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-hairline bg-surface px-2 text-[13px] font-normal tracking-normal text-ink normal-case focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

function NavButton({ label, onClick, forward = false }: { label: string; onClick: () => void; forward?: boolean }) {
  const Icon = forward ? ChevronRight : ChevronLeft
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full border border-hairline text-ink hover:border-indigo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-[0.8px] text-muted uppercase">{label}</dt>
      <dd className={`mt-0.5 text-[13px] ${value ? "text-ink" : "text-placeholder"}`}>{value ?? "Not specified"}</dd>
    </div>
  )
}

function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function weekStart(date: Date): Date {
  return addDays(date, -date.getDay())
}

function shift(date: Date, view: CalendarView, direction: number): Date {
  if (view === "week") {
    return addDays(date, direction * 7)
  }
  return new Date(date.getFullYear(), date.getMonth() + direction, 1)
}

function firstDated(events: CalendarItem[]): Date | null {
  const dated = events.map((event) => event.date).filter(Boolean).sort()
  return dated[0] ? parseIsoDate(dated[0]) : null
}

function groupByDate(events: CalendarItem[]): Map<string, CalendarItem[]> {
  const grouped = new Map<string, CalendarItem[]>()
  for (const event of [...events].sort(byTime)) {
    const list = grouped.get(event.date) ?? []
    list.push(event)
    grouped.set(event.date, list)
  }
  return grouped
}

function groupAgenda(events: CalendarItem[]): Array<{ date: string; events: CalendarItem[] }> {
  const grouped = groupByDate(events)
  return [...grouped.keys()].sort().map((date) => ({ date, events: grouped.get(date) ?? [] }))
}

function byTime(left: CalendarItem, right: CalendarItem): number {
  return `${left.time ?? "99:99"} ${left.title}`.localeCompare(`${right.time ?? "99:99"} ${right.title}`)
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function formatType(type: string | null): string {
  const value = type?.trim()
  if (!value) {
    return "Other"
  }
  const lower = value.toLowerCase()
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

function formatWeight(value: number | null): string | null {
  if (value === null) {
    return null
  }
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `${amount}%`
}

function chipClass(type: string | null): string {
  const value = type?.trim().toUpperCase()
  if (value === "EXAM") {
    return "bg-error-soft text-error"
  }
  if (value === "QUIZ" || value === "ADMIN") {
    return "bg-indigo-soft text-indigo"
  }
  if (value === "ASSIGNMENT" || value === "PROJECT") {
    return "bg-well text-ink"
  }
  return "bg-canvas text-muted"
}

function dotClass(type: string | null): string {
  const value = type?.trim().toUpperCase()
  if (value === "EXAM") {
    return "bg-error"
  }
  if (value === "QUIZ" || value === "ADMIN") {
    return "bg-indigo"
  }
  if (value === "ASSIGNMENT" || value === "PROJECT") {
    return "bg-ink"
  }
  return "bg-placeholder"
}
