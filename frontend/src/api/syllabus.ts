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

type CreateCalendarInput = {
  file: File
  courseName: string
  termStart: string
  termEnd: string
  signal?: AbortSignal
}

export async function createCalendar(input: CreateCalendarInput): Promise<CalendarDownload> {
  const body = new FormData()
  body.append("file", input.file)
  body.append("courseName", input.courseName)
  body.append("termStart", input.termStart)
  body.append("termEnd", input.termEnd)

  let response: Response
  try {
    response = await fetch("/api/syllabus", {
      method: "POST",
      body,
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

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (isApiError(data)) {
      return data.message
    }
  } catch {
    // The error body was not JSON.
  }
  return "Could not create the calendar"
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
