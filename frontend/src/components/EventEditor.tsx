import { useEffect, useId, useRef, useState } from "react"
import type { FormEvent } from "react"

export type EventFields = {
  title: string
  type: string | null
  date: string
  time: string | null
  endTime: string | null
  location: string | null
  weightPercent: number | null
}

type EventEditorProps = {
  heading: string
  initial: EventFields
  notice?: string
  onCancel: () => void
  onSave: (fields: EventFields) => void
}

const KNOWN_TYPES = ["EXAM", "QUIZ", "ASSIGNMENT", "PROJECT", "ADMIN"]

export function EventEditor({ heading, initial, notice, onCancel, onSave }: EventEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [title, setTitle] = useState(initial.title)
  const [type, setType] = useState(initial.type ?? "")
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(clockInput(initial.time))
  const [endTime, setEndTime] = useState(clockInput(initial.endTime))
  const [location, setLocation] = useState(initial.location ?? "")
  const [weight, setWeight] = useState(weightInput(initial.weightPercent))
  const [error, setError] = useState<string>()

  const typeOptions = type && !KNOWN_TYPES.includes(type) ? [type, ...KNOWN_TYPES] : KNOWN_TYPES

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => dialog.close()
  }, [])

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError("Enter an event title.")
      return
    }
    if (!date) {
      setError("Enter a date.")
      return
    }
    if (endTime && !time) {
      setError("Enter a start time, or leave the end time empty.")
      return
    }
    if (time && endTime && endTime <= time) {
      setError("End time must be after the start time.")
      return
    }
    const weightPercent = parseWeight(weight)
    if (weightPercent === undefined) {
      setError("Enter the weight as a number, or leave it empty.")
      return
    }
    setError(undefined)
    onSave({
      title: nextTitle,
      type: type.trim() ? type : null,
      date,
      time: time || null,
      endTime: endTime || null,
      location: location.trim() ? location.trim() : null,
      weightPercent,
    })
  }

  return (
    <dialog
      ref={dialogRef}
      className="review-dialog w-full max-w-[520px]"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <form
        noValidate
        onSubmit={save}
        className="panel flex max-h-[calc(100vh-2rem)] flex-col gap-3.5 overflow-y-auto p-5 shadow-float"
      >
        <h2 id={titleId} className="text-[15px] font-medium tracking-[-0.01em] text-ink">
          {heading}
        </h2>
        <Field label="Title" value={title} onChange={setTitle} autoFocus />
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Type
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="control font-normal"
          >
            <option value="">Not specified</option>
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {formatType(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="control font-normal"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TimeField label="Start time" value={time} onChange={setTime} />
          <TimeField label="End time" value={endTime} onChange={setEndTime} />
        </div>
        <Field label="Location" value={location} onChange={setLocation} placeholder="Optional" />
        <Field label="Weight percentage" value={weight} onChange={setWeight} placeholder="Optional" />
        {error || notice ? (
          <p role="alert" className="text-[12px] leading-4 text-error">
            {error ?? notice}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md px-3 text-[13px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 rounded-md bg-indigo px-3.5 text-[13px] font-medium text-white hover:bg-indigo-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Save event
          </button>
        </div>
      </form>
    </dialog>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoFocus = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        className="control font-normal"
      />
    </label>
  )
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
      {label}
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="control font-normal"
      />
    </label>
  )
}

function clockInput(value: string | null): string {
  return value ? value.slice(0, 5) : ""
}

function weightInput(value: number | null): string {
  return value === null ? "" : String(value)
}

function parseWeight(value: string): number | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined
  }
  return parsed
}

function formatType(type: string): string {
  const lower = type.trim().toLowerCase()
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}
