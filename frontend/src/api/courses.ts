import { apiFetch } from "./http.ts"
import { SyllabusApiError } from "./syllabus.ts"

export type Course = {
  id: string
  name: string
  termStart: string | null
  termEnd: string | null
  eventCount: number
}

export type CourseUpdate = {
  name: string
  termStart: string | null
  termEnd: string | null
}

export async function listCourses(): Promise<Course[]> {
  let response: Response
  try {
    response = await apiFetch("/api/courses", { method: "GET" })
  } catch {
    throw new SyllabusApiError("Could not load courses", 0)
  }
  if (!response.ok) {
    throw new SyllabusApiError("Could not load courses", response.status)
  }
  const data: unknown = await response.json()
  if (!Array.isArray(data)) {
    throw new SyllabusApiError("Could not load courses", response.status)
  }
  return data.map(parseCourse).filter((c): c is Course => c !== null)
}

export async function updateCourse(id: string, update: CourseUpdate): Promise<Course> {
  let response: Response
  try {
    response = await apiFetch(`/api/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    })
  } catch {
    throw new SyllabusApiError("Could not update course", 0)
  }
  if (!response.ok) {
    let message = "Could not update course"
    try {
      const data: unknown = await response.json()
      if (isApiError(data)) message = data.message
    } catch {}
    throw new SyllabusApiError(message, response.status)
  }
  const data: unknown = await response.json()
  const course = parseCourse(data)
  if (!course) throw new SyllabusApiError("Could not update course", response.status)
  return course
}

export async function deleteCourse(id: string): Promise<void> {
  let response: Response
  try {
    response = await apiFetch(`/api/courses/${id}`, { method: "DELETE" })
  } catch {
    throw new SyllabusApiError("Could not delete course", 0)
  }
  if (!response.ok && response.status !== 404) {
    throw new SyllabusApiError("Could not delete course", response.status)
  }
}

function parseCourse(value: unknown): Course | null {
  if (typeof value !== "object" || value === null) return null
  const r = value as Record<string, unknown>
  if (typeof r.id !== "string" || typeof r.name !== "string") return null
  return {
    id: r.id,
    name: r.name,
    termStart: typeof r.termStart === "string" ? r.termStart : null,
    termEnd: typeof r.termEnd === "string" ? r.termEnd : null,
    eventCount: typeof r.eventCount === "number" ? r.eventCount : 0,
  }
}

function isApiError(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as Record<string, unknown>).message === "string"
  )
}
