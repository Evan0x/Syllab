export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function formatLongDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatClock(value: string): string {
  const [hourText, minuteText] = value.split(":")
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return value
  }
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start) {
    return null
  }
  const startLabel = formatClock(start)
  if (!end || end <= start) {
    return startLabel
  }
  return `${startLabel} – ${formatClock(end)}`
}

export function formatWeekday(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
}

export function formatMonthDay(iso: string): { month: string; day: string } {
  const date = parseIsoDate(iso)
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }),
    day: String(date.getDate()),
  }
}

export function formatMonthHeading(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export function formatTermRange(start: string, end: string): string {
  const startDate = parseIsoDate(start)
  const endDate = parseIsoDate(end)
  const sameYear = startDate.getFullYear() === endDate.getFullYear()
  const startText = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
  })
  const endText = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${startText} – ${endText}`
}
