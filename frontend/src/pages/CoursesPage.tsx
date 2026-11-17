import { BookOpen, LoaderCircle, TriangleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { deleteCourse, listCourses, updateCourse } from "../api/courses.ts"
import type { Course } from "../api/courses.ts"
import { SyllabusApiError } from "../api/syllabus.ts"
import { Button } from "../components/Button.tsx"
import { ConfirmDialog } from "../components/ConfirmDialog.tsx"
import { DateField } from "../components/DateField.tsx"
import { EmptyState } from "../components/EmptyState.tsx"
import { PageHeader } from "../components/PageHeader.tsx"
import { PageShell } from "../components/PageShell.tsx"
import { TextField } from "../components/TextField.tsx"
import { formatLongDate, formatTermRange } from "../lib/dates.ts"
import { usePageTitle } from "../lib/pageTitle.ts"

type ExistingCourse = {
  id: string
  courseName: string
  termStart: string
  termEnd: string
}

export function CoursesPage({ email, onLogout, isGuest = false }: { email: string; onLogout: () => void; isGuest?: boolean }) {
  usePageTitle("Courses · Syllapin")
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [loadError, setLoadError] = useState<string>()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editTermStart, setEditTermStart] = useState("")
  const [editTermEnd, setEditTermEnd] = useState("")
  const [nameError, setNameError] = useState<string>()
  const [endError, setEndError] = useState<string>()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string>()
  const request = useRef(0)

  function load() {
    const token = ++request.current
    setLoadError(undefined)
    setCourses(null)
    listCourses()
      .then((loaded) => {
        if (token === request.current) setCourses(loaded)
      })
      .catch((err) => {
        if (token === request.current) {
          setCourses([])
          setLoadError(err instanceof SyllabusApiError ? err.message : "Could not load courses")
        }
      })
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(course: Course) {
    setEditingId(course.id)
    setEditName(course.name)
    setEditTermStart(course.termStart ?? "")
    setEditTermEnd(course.termEnd ?? "")
    setNameError(undefined)
    setEndError(undefined)
    setActionError(undefined)
  }

  function cancelEdit() {
    setEditingId(null)
    setNameError(undefined)
    setEndError(undefined)
  }

  async function saveEdit() {
    if (!editingId || actionLoading) return
    const name = editName.trim()
    if (!name) {
      setNameError("Course name is required")
      return
    }
    if (name.length > 200) {
      setNameError("Must be at most 200 characters")
      return
    }
    if (editTermStart && editTermEnd && editTermEnd < editTermStart) {
      setEndError(`End date must be on or after ${formatLongDate(editTermStart)}`)
      return
    }
    setActionLoading(true)
    setActionError(undefined)
    try {
      const updated = await updateCourse(editingId, {
        name,
        termStart: editTermStart || null,
        termEnd: editTermEnd || null,
      })
      setCourses((prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)))
      setEditingId(null)
    } catch (err) {
      setActionError(err instanceof SyllabusApiError ? err.message : "Could not save")
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId || actionLoading) return
    setActionLoading(true)
    setActionError(undefined)
    try {
      await deleteCourse(pendingDeleteId)
      setCourses((prev) => (prev ?? []).filter((c) => c.id !== pendingDeleteId))
      setPendingDeleteId(null)
    } catch (err) {
      setPendingDeleteId(null)
      setActionError(err instanceof SyllabusApiError ? err.message : "Could not delete course")
    } finally {
      setActionLoading(false)
    }
  }

  function handleReupload(course: Course) {
    const payload: ExistingCourse = {
      id: course.id,
      courseName: course.name,
      termStart: course.termStart ?? "",
      termEnd: course.termEnd ?? "",
    }
    try {
      sessionStorage.setItem("reupload", JSON.stringify(payload))
    } catch {}
    window.location.href = "/"
  }

  const pendingDelete = courses?.find((c) => c.id === pendingDeleteId)

  return (
    <PageShell email={email} onLogout={onLogout} isGuest={isGuest}>
      <PageHeader
        eyebrow="Account"
        title="Your courses"
        description="Manage the syllabi and calendar events saved to your account."
      />

      {courses === null ? (
        <EmptyState
          icon={LoaderCircle}
          tone="loading"
          title="Loading your courses"
          message="Pulling your saved syllabi."
        />
      ) : loadError ? (
        <EmptyState
          icon={TriangleAlert}
          tone="error"
          title="Courses couldn't load"
          message={loadError}
          action={
            <div className="w-full max-w-xs">
              <Button onClick={load}>Try again</Button>
            </div>
          }
        />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          message="Upload a syllabus PDF to create your first course and calendar."
          action={
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-indigo px-4 text-[13px] font-medium text-white hover:bg-indigo-deep active:bg-indigo-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              Upload a syllabus
            </a>
          }
        />
      ) : (
        <section className="panel overflow-hidden">
          <ol>
            {courses.map((course, index) => (
              <li
                key={course.id}
                className={`border-b border-hairline last:border-b-0 ${index === 0 ? "" : ""}`}
              >
                {editingId === course.id ? (
                  <CourseEditForm
                    course={course}
                    name={editName}
                    termStart={editTermStart}
                    termEnd={editTermEnd}
                    nameError={nameError}
                    endError={endError}
                    saving={actionLoading}
                    onNameChange={(v) => { setEditName(v); setNameError(undefined) }}
                    onTermStartChange={(v) => { setEditTermStart(v); setEndError(undefined) }}
                    onTermEndChange={(v) => { setEditTermEnd(v); setEndError(undefined) }}
                    onSave={() => void saveEdit()}
                    onCancel={cancelEdit}
                  />
                ) : (
                  <CourseRow
                    course={course}
                    onEdit={() => startEdit(course)}
                    onDelete={() => { setActionError(undefined); setPendingDeleteId(course.id) }}
                    onReupload={() => handleReupload(course)}
                  />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {actionError ? (
        <p role="alert" className="text-[12px] leading-[1.45] text-error">
          {actionError}
        </p>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this course?"
          message={`${pendingDelete.name} and all ${pendingDelete.eventCount} associated calendar event${pendingDelete.eventCount === 1 ? "" : "s"} will be permanently deleted.`}
          confirmLabel="Delete course"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => { void confirmDelete() }}
        />
      ) : null}
    </PageShell>
  )
}

function CourseRow({
  course,
  onEdit,
  onDelete,
  onReupload,
}: {
  course: Course
  onEdit: () => void
  onDelete: () => void
  onReupload: () => void
}) {
  const termRange =
    course.termStart && course.termEnd ? formatTermRange(course.termStart, course.termEnd) : null

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[14px] font-medium tracking-[-0.01em] text-ink">{course.name}</p>
        <p className="mt-0.5 text-[12px] text-muted">
          {termRange ?? "No dates set"}
          {" · "}
          {course.eventCount} event{course.eventCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="text-[12px] text-indigo hover:text-indigo-deep focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onReupload}
          className="text-[12px] text-indigo hover:text-indigo-deep focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        >
          Replace syllabus
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-[12px] text-error hover:opacity-75 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function CourseEditForm({
  course,
  name,
  termStart,
  termEnd,
  nameError,
  endError,
  saving,
  onNameChange,
  onTermStartChange,
  onTermEndChange,
  onSave,
  onCancel,
}: {
  course: Course
  name: string
  termStart: string
  termEnd: string
  nameError: string | undefined
  endError: string | undefined
  saving: boolean
  onNameChange: (v: string) => void
  onTermStartChange: (v: string) => void
  onTermEndChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <p className="text-[12px] font-medium text-muted">Editing {course.name}</p>
      <TextField
        id={`edit-name-${course.id}`}
        label="Course name"
        value={name}
        placeholder="e.g. PSYC 101 · Intro to Psychology"
        error={nameError}
        onChange={onNameChange}
      />
      <div>
        <div className="grid grid-cols-2 gap-3">
          <DateField
            id={`edit-start-${course.id}`}
            label="Semester starts"
            value={termStart}
            invalid={false}
            onChange={onTermStartChange}
          />
          <DateField
            id={`edit-end-${course.id}`}
            label="Semester ends"
            value={termEnd}
            invalid={Boolean(endError)}
            onChange={onTermEndChange}
          />
        </div>
        {endError ? (
          <p role="alert" className="mt-2 text-[12px] leading-[1.5] text-error">
            {endError}
          </p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <div className="w-28">
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] text-muted hover:text-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
