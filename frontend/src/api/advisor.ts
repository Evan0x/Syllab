import { apiFetch } from "./http.ts"
import { SyllabusApiError } from "./syllabus.ts"

export type WeightNote = {
  eventId: string
  title: string
  date: string
  weight: number
}

export type DeadlineNote = {
  eventId: string
  title: string
  type: string
  date: string
  start: string | null
  end: string | null
  location: string | null
  weight: number | null
  quote: string | null
  confidence: string | null
}

export type BusyWeek = {
  start: string
  end: string
  events: number
  reasons: string[]
}

export type CourseBrief = {
  id: string
  name: string
  termStart: string | null
  termEnd: string | null
  assignments: number
  exams: number
  quizzes: number
  projects: number
  admin: number
  other: number
  upcoming: number
  weightsMissing: number
  weights: WeightNote[]
  weightTotal: number
  deadlines: DeadlineNote[]
  upcomingTotal: number
  busyWeeks: BusyWeek[]
}

export type NextExam = {
  eventId: string
  courseId: string
  courseName: string
  title: string
  date: string
  quote: string | null
}

export type AdvisorAnalysis = {
  today: string
  courses: CourseBrief[]
  busyWeeks: BusyWeek[]
  overlaps: { date: string; titles: string[] }[]
  nextExam: NextExam | null
  preparation: { examDate: string; calendarDays: number; note: string } | null
  upcomingExams: NextExam[]
  examsWithinTwoWeeks: NextExam[]
  missing: string[]
}

export type Citation = {
  eventId: string
  courseName: string
  title: string
  type: string
  date: string
  weight: number | null
  quote: string | null
}

export type AdvisorAnswer = {
  available: boolean
  answer: string | null
  citations: Citation[]
  missing: string[]
  status: "answered" | "rejected" | "unavailable"
}

export type AdvisorTurn = {
  role: "user" | "assistant"
  text: string
}

export async function loadAdvisor(today: string): Promise<AdvisorAnalysis> {
  const response = await request(`/api/advisor?today=${encodeURIComponent(today)}`, { method: "GET" })
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new SyllabusApiError("Could not read the course analysis", response.status)
  }
  if (!isRecord(data) || !Array.isArray(data.courses) || !Array.isArray(data.missing)) {
    throw new SyllabusApiError("Could not read the course analysis", response.status)
  }
  return data as AdvisorAnalysis
}

export async function askAdvisor(input: {
  today: string
  courseIds: string[]
  question: string
  history: AdvisorTurn[]
}): Promise<AdvisorAnswer> {
  const response = await request("/api/advisor/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new SyllabusApiError("Could not read the answer", response.status)
  }
  if (!isRecord(data) || !Array.isArray(data.citations) || !Array.isArray(data.missing)) {
    throw new SyllabusApiError("Could not read the answer", response.status)
  }
  const status = data.status === "rejected" || data.status === "unavailable" ? data.status : "answered"
  return {
    available: data.available === true,
    answer: typeof data.answer === "string" ? data.answer : null,
    citations: data.citations.filter(isCitation),
    missing: data.missing.filter((item): item is string => typeof item === "string"),
    status: data.available === true ? "answered" : status,
  }
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await apiFetch(path, init)
  } catch {
    throw new SyllabusApiError("Could not reach the advisor", 0)
  }
  if (!response.ok) {
    throw new SyllabusApiError(await readMessage(response), response.status)
  }
  return response
}

function isCitation(value: unknown): value is Citation {
  return isRecord(value) && typeof value.title === "string" && typeof value.date === "string"
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
  return "Could not load the advisor"
}
