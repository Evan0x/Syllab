import { ArrowRight, CalendarDays, LockKeyhole } from "lucide-react"
import { useRef, useState } from "react"
import type { FormEvent } from "react"
import { isAbortError, previewSyllabus, SyllabusApiError, type PreviewResponse } from "../api/syllabus.ts"
import { Button } from "../components/Button.tsx"
import { ConversionStatus } from "../components/ConversionStatus.tsx"
import { DateField } from "../components/DateField.tsx"
import { FileDropzone } from "../components/FileDropzone.tsx"
import { HowItWorks } from "../components/HowItWorks.tsx"
import { SiteFooter } from "../components/SiteFooter.tsx"
import { SiteHeader } from "../components/SiteHeader.tsx"
import { TextField } from "../components/TextField.tsx"
import { formatLongDate, formatTermRange } from "../lib/dates.ts"
import { inspectSyllabusFile, type FileProblem } from "../lib/files.ts"

type Phase = "form" | "loading" | "error"

type LandingPageProps = {
  email: string
  onLogout: () => void
  onPreview: (preview: PreviewResponse, term: { termStart: string; termEnd: string }) => void
}

const MISSING_FILE = "No file selected. Upload a syllabus PDF before generating your calendar."
const MISSING_COURSE = "Enter a course name to label your events."
const MISSING_START = "Enter the first day of your semester."
const MISSING_END = "Enter the last day of your semester."

export function LandingPage({ email, onLogout, onPreview }: LandingPageProps) {
  const [file, setFile] = useState<File | null>(null)
  const [problem, setProblem] = useState<FileProblem | null>(null)
  const [missingFile, setMissingFile] = useState<string>()
  const [courseName, setCourseName] = useState("")
  const [termStart, setTermStart] = useState("")
  const [termEnd, setTermEnd] = useState("")
  const [courseError, setCourseError] = useState<string>()
  const [startError, setStartError] = useState<string>()
  const [endError, setEndError] = useState<string>()
  const [phase, setPhase] = useState<Phase>("form")
  const [apiMessage, setApiMessage] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const submitting = useRef(false)

  const termLabel = termStart && termEnd ? formatTermRange(termStart, termEnd) : ""

  async function chooseFile(next: File) {
    setMissingFile(undefined)
    setFile(next)
    setProblem(await inspectSyllabusFile(next))
  }

  function fieldErrors(course: string, start: string, end: string) {
    const nextCourse = course ? undefined : MISSING_COURSE
    const nextStart = start ? undefined : MISSING_START
    let nextEnd: string | undefined
    if (!end) {
      nextEnd = MISSING_END
    } else if (start && end < start) {
      nextEnd = `End date must be on or after ${formatLongDate(start)}.`
    }
    return { nextCourse, nextStart, nextEnd }
  }

  function focusFirstInvalid(hasFileProblem: boolean, errors: ReturnType<typeof fieldErrors>) {
    const id = hasFileProblem
      ? "syllabus-file"
      : errors.nextCourse
        ? "course-name"
        : errors.nextStart
          ? "term-start"
          : "term-end"
    document.getElementById(id)?.focus()
  }

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (submitting.current) {
      return
    }

    const course = courseName.trim()
    const errors = fieldErrors(course, termStart, termEnd)
    const inspected = file ? await inspectSyllabusFile(file) : null
    setCourseError(errors.nextCourse)
    setStartError(errors.nextStart)
    setEndError(errors.nextEnd)
    setProblem(inspected)
    setMissingFile(file ? undefined : MISSING_FILE)
    if (!file || inspected || errors.nextCourse || errors.nextStart || errors.nextEnd) {
      focusFirstInvalid(!file || inspected !== null, errors)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    submitting.current = true
    setPhase("loading")
    try {
      const result = await previewSyllabus({
        file,
        courseName: course,
        termStart,
        termEnd,
        signal: controller.signal,
      })
      setPhase("form")
      onPreview(result, { termStart, termEnd })
    } catch (error) {
      if (isAbortError(error)) {
        setPhase("form")
        return
      }
      setApiMessage(
        error instanceof SyllabusApiError ? error.message : "Could not read this syllabus",
      )
      setPhase("error")
    } finally {
      submitting.current = false
      abortRef.current = null
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  function replaceFile() {
    setPhase("form")
    setFile(null)
    setProblem(null)
    setMissingFile(undefined)
    setApiMessage("")
  }

  return (
    <div id="top" className="bg-canvas text-ink">
      <SiteHeader email={email} onLogout={onLogout} />
      <main>
        <section className="flex flex-col items-start gap-4 px-6 pt-9 pb-7 lg:items-center lg:gap-[18px] lg:px-10 lg:pt-[53px] lg:pb-[38px] xl:px-20">
          <p className="text-[10px] font-semibold tracking-[1.2px] text-indigo lg:text-[11px] lg:tracking-[1.7px]">
            <span className="lg:hidden">LESS ADMIN. MORE SEMESTER.</span>
            <span className="hidden lg:inline">A LITTLE LESS ADMIN. A LOT MORE SEMESTER.</span>
          </p>
          <h1 className="text-[44px] leading-[1.06] font-medium tracking-[-1.8px] text-ink lg:text-center lg:text-[59px] lg:leading-[1.15] lg:tracking-[-2.5px]">
            <span className="block lg:inline">Your syllabus, </span>
            <span className="block font-serif text-[49px] leading-[1.06] italic lg:inline lg:text-[68px] lg:leading-[1.15]">
              on your calendar.
            </span>
          </h1>
          <p className="max-w-[620px] text-[15px] leading-[1.65] text-muted lg:text-center lg:text-[16px]">
            <span className="lg:hidden">
              Turn your syllabus PDF into a calendar of classes, assignments and exams. One upload. A clearer semester.
            </span>
            <span className="hidden lg:block">
              Turn your syllabus PDF into a calendar of classes, assignments and exams.
              <br />
              One upload. A clearer semester. No manual date entry.
            </span>
          </p>
          <p className="text-[12px] text-indigo lg:hidden">Free to use.</p>
        </section>

        <section className="px-6 lg:px-10 xl:px-20">
          <div className="mx-auto w-full max-w-[960px] rounded-2xl border border-hairline bg-surface shadow-[0_8px_32px_rgba(39,35,62,0.03)]">
            {phase === "form" ? (
              <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-[22px] p-5 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-3 lg:p-8">
                <div className="flex items-center justify-between lg:col-span-2 lg:mb-[14px]">
                  <h2 className="text-[19px] tracking-[-0.4px] text-ink">Create your calendar</h2>
                  <p className="hidden items-center gap-[7px] text-[12px] text-muted lg:flex">
                    <CalendarDays size={14} strokeWidth={1.75} aria-hidden />
                    PDF → .ics
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 lg:gap-3">
                  <label htmlFor="syllabus-file" className="text-[13px] text-ink">
                    Syllabus PDF
                  </label>
                  <FileDropzone file={file} problem={problem} onFile={(next) => void chooseFile(next)} />
                  {missingFile ? (
                    <p role="alert" className="text-[12px] leading-[1.5] text-error">
                      {missingFile}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-[22px]">
                  <div className="flex flex-col gap-5">
                    <TextField
                      id="course-name"
                      label="Course name"
                      value={courseName}
                      placeholder="e.g. PSYC 101 · Intro to Psychology"
                      error={courseError}
                      onChange={(value) => {
                        setCourseName(value)
                        setCourseError(undefined)
                      }}
                    />
                    <div>
                      <div className="grid grid-cols-2 gap-3">
                        <DateField
                          id="term-start"
                          label="Semester starts"
                          value={termStart}
                          invalid={Boolean(startError)}
                          onChange={(value) => {
                            setTermStart(value)
                            setStartError(undefined)
                            setEndError(undefined)
                          }}
                        />
                        <DateField
                          id="term-end"
                          label="Semester ends"
                          value={termEnd}
                          invalid={Boolean(endError)}
                          onChange={(value) => {
                            setTermEnd(value)
                            setEndError(undefined)
                          }}
                        />
                      </div>
                      {startError || endError ? (
                        <p role="alert" className="mt-2 text-[12px] leading-[1.5] text-error">
                          {[startError, endError].filter(Boolean).join(" ")}
                        </p>
                      ) : (
                        <p className="mt-5 text-[12px] leading-[1.5] text-muted">
                          Use the first and last day of your semester.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 lg:gap-[10px]">
                    <Button icon={ArrowRight} type="submit">
                      Generate calendar
                    </Button>
                    <p className="text-center text-[11px] leading-[1.5] text-muted lg:leading-normal">
                      Add your PDF and course details to get started.
                    </p>
                  </div>
                </div>

                <p id="privacy" className="flex items-start gap-2 text-[11px] leading-[1.5] text-muted lg:col-start-1 lg:items-center lg:gap-[7px] lg:leading-normal">
                  <LockKeyhole size={13} className="mt-px shrink-0 lg:mt-0" aria-hidden />
                  Your syllabus is private and deleted after processing.
                </p>
              </form>
            ) : phase === "loading" ? (
              <ConversionStatus
                phase="loading"
                courseName={courseName.trim()}
                termLabel={termLabel}
                onCancel={cancel}
              />
            ) : (
              <ConversionStatus
                phase="error"
                courseName={courseName.trim()}
                termLabel={termLabel}
                message={apiMessage}
                onReplace={replaceFile}
                onRetry={() => void submit()}
              />
            )}
          </div>

          <div className="mx-auto flex max-w-[960px] flex-col items-center gap-2 py-[25px] text-center lg:flex-row lg:justify-center lg:gap-[10px] lg:pt-[22px] lg:pb-[30px]">
            <p className="text-[12px] text-muted">One file. Your favorite calendar.</p>
            <p className="text-[11px] font-medium whitespace-pre text-ink lg:text-[12px]">
              {"Google Calendar   ·   Apple Calendar   ·   Outlook"}
            </p>
          </div>
        </section>
        <HowItWorks />
      </main>
      <SiteFooter />
    </div>
  )
}
