function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

export function formatLongDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
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
