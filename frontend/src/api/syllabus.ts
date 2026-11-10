import { apiFetch } from "./http.ts"

export class SyllabusApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "SyllabusApiError"
    this.status = status
  }
}

export type CalendarDownload = {
  blob: Blob
  filename: string
}

export type CalendarEvent = {
  title: string | null
  type: string | null
  date: string | null
  time: string | null
  endTime: string | null
  location: string | null
  weightPercent: number | null
  confidence: string | null
  sourceQuote: string | null
}

export type PreviewResponse = {
  courseName: string
  events: CalendarEvent[]
  warnings: string[]
}

type CreateCalendarInput = {
  file: File
  courseName: string
  termStart: string
  termEnd: string
  signal?: AbortSignal
}

export async function previewSyllabus(input: CreateCalendarInput): Promise<PreviewResponse> {
  let response: Response
  try {
    response = await apiFetch("/api/syllabus/preview", {
      method: "POST",
      body: syllabusForm(input),
      signal: input.signal,
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new SyllabusApiError("Could not read this syllabus", 0)
  }

  if (!response.ok) {
    throw new SyllabusApiError(await readErrorMessage(response), response.status)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new SyllabusApiError("Could not read this syllabus", response.status)
  }
  const preview = parsePreviewResponse(data)
  if (!preview) {
    throw new SyllabusApiError("Could not read this syllabus", response.status)
  }
  return preview
}

export async function exportCalendar(input: {
  courseName: string
  events: CalendarEvent[]
  signal?: AbortSignal
}): Promise<CalendarDownload> {
  let response: Response
  try {
    response = await apiFetch("/api/syllabus/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseName: input.courseName,
        events: input.events.map(toExportEvent),
      }),
      signal: input.signal,
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new SyllabusApiError("Could not export the calendar", 0)
  }

  if (!response.ok) {
    throw new SyllabusApiError(await readErrorMessage(response, "Could not export the calendar"), response.status)
  }

  const blob = await response.blob()
  return { blob, filename: calendarFilename(input.courseName) }
}

export function calendarFilename(courseName: string): string {
  const safe = courseName
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${safe || "syllapin"}-calendar.ics`
}

export async function createCalendar(input: CreateCalendarInput): Promise<CalendarDownload> {
  let response: Response
  try {
    response = await apiFetch("/api/syllabus", {
      method: "POST",
      body: syllabusForm(input),
      signal: input.signal,
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new SyllabusApiError("Could not create the calendar", 0)
  }

  if (!response.ok) {
    throw new SyllabusApiError(await readErrorMessage(response), response.status)
  }

  const blob = await response.blob()
  return {
    blob,
    filename: filenameFromDisposition(response.headers.get("Content-Disposition")),
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError"
}

export function filenameFromDisposition(header: string | null): string {
  if (!header) {
    return "syllabus.ics"
  }

  const encoded = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(header)
  if (encoded?.[1]) {
    const raw = encoded[1].trim().replace(/^"|"$/g, "")
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }

  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted?.[1]) {
    return quoted[1]
  }

  const plain = /filename=([^;]+)/i.exec(header)
  if (plain?.[1]) {
    return plain[1].trim().replace(/^"|"$/g, "")
  }

  return "syllabus.ics"
}

function toExportEvent(event: CalendarEvent) {
  return {
    title: event.title,
    type: emptyToNull(event.type),
    date: event.date,
    time: emptyToNull(event.time),
    endTime: emptyToNull(event.endTime),
    location: emptyToNull(event.location),
    weightPercent: event.weightPercent,
    confidence: emptyToNull(event.confidence),
    sourceQuote: event.sourceQuote,
  }
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function readErrorMessage(
  response: Response,
  fallback = "Could not create the calendar",
): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (isApiError(data)) {
      return data.message
    }
  } catch {
    // The error body was not JSON.
  }
  return fallback
}

function syllabusForm(input: CreateCalendarInput): FormData {
  const body = new FormData()
  body.append("file", input.file)
  body.append("courseName", input.courseName)
  body.append("termStart", input.termStart)
  body.append("termEnd", input.termEnd)
  return body
}

function parsePreviewResponse(value: unknown): PreviewResponse | null {
  if (!isRecord(value) || typeof value.courseName !== "string" || !Array.isArray(value.events)) {
    return null
  }
  if (value.warnings !== undefined && !isStringList(value.warnings)) {
    return null
  }
  const events: CalendarEvent[] = []
  for (const item of value.events) {
    const event = normalizeEvent(item)
    if (!event) {
      return null
    }
    events.push(event)
  }
  return {
    courseName: value.courseName,
    events,
    warnings: isStringList(value.warnings) ? value.warnings : [],
  }
}

function normalizeEvent(value: unknown): CalendarEvent | null {
  if (!isRecord(value)) {
    return null
  }
  const title = nullableString(value.title)
  const type = nullableString(value.type)
  const date = nullableString(value.date)
  const time = nullableString(value.time)
  const endTime = nullableString(value.endTime)
  const location = nullableString(value.location)
  const confidence = nullableString(value.confidence)
  const weightPercent = nullableNumber(value.weightPercent)
  if (
    title === undefined ||
    type === undefined ||
    date === undefined ||
    time === undefined ||
    endTime === undefined ||
    location === undefined ||
    confidence === undefined ||
    weightPercent === undefined
  ) {
    return null
  }
  return {
    title,
    type,
    date,
    time,
    endTime,
    location,
    weightPercent,
    confidence,
    sourceQuote: optionalQuote(value),
  }
}

function optionalQuote(value: Record<string, unknown>): string | null {
  for (const key of ["sourceQuote", "sourceText", "source_text"]) {
    const quote = value[key]
    if (typeof quote !== "string") {
      continue
    }
    const trimmed = quote.trim()
    if (trimmed) {
      return trimmed
    }
  }
  return null
}

function nullableString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null
  }
  return typeof value === "string" ? value : undefined
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null) {
    return null
  }
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isApiError(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.length > 0
  )
}
