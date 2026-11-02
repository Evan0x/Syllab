export const MAX_SYLLABUS_BYTES = 10 * 1024 * 1024

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]

export type FileProblem = "too-large" | "not-pdf" | "unsupported"

export async function inspectSyllabusFile(file: File): Promise<FileProblem | null> {
  if (file.size > MAX_SYLLABUS_BYTES) {
    return "too-large"
  }
  if (file.size < PDF_MAGIC.length) {
    return file.name.toLowerCase().endsWith(".pdf") ? "not-pdf" : "unsupported"
  }

  const header = new Uint8Array(await file.slice(0, PDF_MAGIC.length).arrayBuffer())
  const isPdf = PDF_MAGIC.every((byte, index) => header[index] === byte)
  if (isPdf) {
    return null
  }
  return file.name.toLowerCase().endsWith(".pdf") ? "not-pdf" : "unsupported"
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fileProblemMessage(file: File, problem: FileProblem): string {
  if (problem === "too-large") {
    return "Upload a PDF under 10 MB."
  }
  if (problem === "not-pdf") {
    return "File is not a PDF"
  }
  return `${file.name} isn’t supported. Export it as a PDF and try again.`
}
