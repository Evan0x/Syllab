import { apiFetch } from "./http.ts"
import { SyllabusApiError } from "./syllabus.ts"

export type CourseCount = {
  name: string
  events: number
}

export type WeekLoad = {
  start: string
  end: string
  assignments: number
  exams: number
  other: number
  total: number
  courses: CourseCount[]
}

export type DayLoad = {
  date: string
  assignments: number
  exams: number
  other: number
  total: number
}

export type Deadline = {
  title: string
  type: string
  date: string
  weightPercent: number | null
}

export type CourseLoad = {
  id: string
  name: string
  termStart: string | null
  termEnd: string | null
  upcomingAssignments: number
  upcomingExams: number
  upcomingEvents: number
  eventShare: number | null
  weightsMissing: number
  weightsPresent: number[]
  deadlines: Deadline[]
}

export type WorkloadReport = {
  today: string
  semesterStart: string | null
  semesterEnd: string | null
  semesterTruncated: boolean
  activeCourses: number
  upcomingAssignments: number
  upcomingExams: number
  dueThisWeek: number
  dueNextWeek: number
  busiestWeek: { start: string; end: string; events: number } | null
  facts: string[]
  busyWeeks: { start: string; end: string; events: number; reasons: string[] }[]
  crowdedDays: { date: string; events: number }[]
  overlaps: { date: string; titles: string[] }[]
  courses: CourseLoad[]
  currentWeek: DayLoad[]
  nextFourWeeks: WeekLoad[]
  semesterWeeks: WeekLoad[]
}

export type WorkloadInsights = {
  available: boolean
  suggestions: string[]
}

export async function loadWorkload(today: string): Promise<WorkloadReport> {
  const response = await request(`/api/workload?today=${encodeURIComponent(today)}`, { method: "GET" })
  return readReport(response)
}

export async function loadWorkloadInsights(today: string): Promise<WorkloadInsights> {
  const response = await request("/api/workload/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ today }),
  })
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new SyllabusApiError("Could not read the suggestions", response.status)
  }
  if (!isRecord(data) || !Array.isArray(data.suggestions)) {
    throw new SyllabusApiError("Could not read the suggestions", response.status)
  }
  return {
    available: data.available === true,
    suggestions: data.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
  }
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await apiFetch(path, init)
  } catch {
    throw new SyllabusApiError("Could not reach the workload", 0)
  }
  if (!response.ok) {
    throw new SyllabusApiError(await readMessage(response), response.status)
  }
  return response
}

async function readReport(response: Response): Promise<WorkloadReport> {
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new SyllabusApiError("Could not read the workload", response.status)
  }
  if (!isRecord(data) || !Array.isArray(data.facts) || !Array.isArray(data.courses) || !Array.isArray(data.currentWeek)) {
    throw new SyllabusApiError("Could not read the workload", response.status)
  }
  return data as WorkloadReport
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
  return "Could not load the workload"
}
