import { apiFetch } from "./http.ts"
import { SyllabusApiError } from "./syllabus.ts"

export type StoredEvent = {
  id: string
  courseId: string
  courseName: string
  title: string
  type: string
  date: string
  time: string | null
  endTime: string | null
  location: string | null
  weightPercent: number | null
  confidence: string | null
  sourceQuote: string | null
  reviewStatus: string
}

export type CalendarWriteEvent = {
  id: string
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

export async function listEvents(): Promise<StoredEvent[]> {
  return readEvents(await request("/api/events", { method: "GET" }))
}

export async function saveReviewedCalendar(input: {
  courseId: string
  courseName: string
  termStart: string | null
  termEnd: string | null
  events: CalendarWriteEvent[]
}): Promise<StoredEvent[]> {
  return readEvents(
    await request("/api/events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  )
}

export async function updateEvent(
  id: string,
  fields: {
    title: string
    type: string | null
    date: string
    time: string | null
    endTime: string | null
    location: string | null
    weightPercent: number | null
  },
): Promise<StoredEvent> {
  const response = await request(`/api/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  })
  const event = parseEvent(await response.json())
  if (!event) {
    throw new SyllabusApiError("Could not save this event", response.status)
  }
  return event
}

export async function deleteEvent(id: string): Promise<void> {
  await request(`/api/events/${id}`, { method: "DELETE" })
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await apiFetch(path, init)
  } catch {
    throw new SyllabusApiError("Could not reach the calendar", 0)
  }
  if (!response.ok) {
    throw new SyllabusApiError(await readMessage(response), response.status)
  }
  return response
}

async function readEvents(response: Response): Promise<StoredEvent[]> {
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new SyllabusApiError("Could not read the calendar", response.status)
  }
  if (!Array.isArray(data)) {
    throw new SyllabusApiError("Could not read the calendar", response.status)
  }
  const events: StoredEvent[] = []
  for (const item of data) {
    const event = parseEvent(item)
    if (!event) {
      throw new SyllabusApiError("Could not read the calendar", response.status)
    }
    events.push(event)
  }
  return events
}

function parseEvent(value: unknown): StoredEvent | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.date !== "string") {
    return null
  }
  const type = typeof value.type === "string" ? value.type : "OTHER"
  const courseName = typeof value.courseName === "string" ? value.courseName : ""
  const courseId = typeof value.courseId === "string" ? value.courseId : ""
  return {
    id: value.id,
    courseId,
    courseName,
    title: value.title,
    type,
    date: value.date,
    time: nullableString(value.time),
    endTime: nullableString(value.endTime),
    location: nullableString(value.location),
    weightPercent: nullableNumber(value.weightPercent),
    confidence: nullableString(value.confidence),
    sourceQuote: nullableString(value.sourceQuote),
    reviewStatus: typeof value.reviewStatus === "string" ? value.reviewStatus : "CONFIRMED",
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function readMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (isRecord(data) && typeof data.message === "string" && data.message) {
      return data.message
    }
  } catch {
    // The error body was not JSON.
  }
  return "Could not save the calendar"
}
