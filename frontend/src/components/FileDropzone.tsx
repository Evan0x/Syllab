import { ArrowDownToLine, FileCheck, FileExclamationPoint, RefreshCw, Upload } from "lucide-react"
import { useRef, useState } from "react"
import type { DragEvent } from "react"
import { fileProblemMessage, formatFileSize, type FileProblem } from "../lib/files.ts"

type FileDropzoneProps = {
  file: File | null
  problem: FileProblem | null
  onFile: (file: File) => void
}

export function FileDropzone({ file, problem, onFile }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [hovering, setHovering] = useState(false)
  const [dragging, setDragging] = useState(false)

  const mode = dragging
    ? "drag"
    : problem
      ? "invalid"
      : file
        ? "ready"
        : hovering
          ? "hover"
          : "empty"

  const title =
    mode === "drag"
      ? "Drop your syllabus here"
      : mode === "invalid" && problem === "too-large"
        ? "This file is too large"
        : mode === "ready" || mode === "invalid"
          ? file?.name
          : "Drop your syllabus PDF here"

  const detail =
    mode === "drag"
      ? "One PDF. One organized semester."
      : mode === "ready" && file
        ? `${formatFileSize(file.size)} · PDF · Ready to convert`
        : mode === "invalid" && file
        ? problem === "too-large"
          ? `${file.name} · ${formatFileSize(file.size)}`
          : formatFileSize(file.size)
        : "or choose a file from your device"

  const action =
    mode === "drag"
      ? "Release to upload"
      : mode === "invalid" && problem === "too-large"
        ? "Choose a smaller PDF"
        : mode === "invalid"
          ? "Choose a PDF"
          : mode === "ready"
            ? "Replace file"
            : "Browse files"

  const hint =
    mode === "invalid" && file && problem
      ? fileProblemMessage(file, problem)
      : "PDF only · Up to 10 MB · One course at a time"

  function takeFile(next: File | undefined) {
    if (next) {
      onFile(next)
    }
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragging(false)
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    takeFile(event.dataTransfer.files[0])
  }

  const wellClass =
    mode === "ready"
      ? "bg-success-soft text-success"
      : mode === "hover" || mode === "drag"
        ? "bg-surface text-indigo"
        : mode === "invalid"
          ? "bg-well text-error"
          : "bg-well text-[#7c7ab8]"

  const zoneClass =
    mode === "ready"
      ? "border-solid border-hairline bg-surface"
      : mode === "invalid"
        ? "border-dashed border-error bg-error-soft"
        : mode === "hover" || mode === "drag"
          ? "border-dashed border-indigo bg-indigo-soft"
          : "border-dashed border-hairline bg-drop"

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => inputRef.current?.click()}
      className={`flex min-h-[210px] cursor-pointer flex-col items-center justify-center gap-[14px] rounded-lg border p-5 text-center lg:min-h-[246px] lg:p-7 ${zoneClass}`}
    >
      <input
        ref={inputRef}
        id="syllabus-file"
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-describedby="syllabus-hint"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          takeFile(event.target.files?.[0])
          event.target.value = ""
        }}
      />
      <span className={`flex size-11 items-center justify-center rounded-[10px] ${wellClass}`}>
        {mode === "drag" ? (
          <ArrowDownToLine size={22} strokeWidth={1.75} aria-hidden />
        ) : mode === "ready" ? (
          <FileCheck size={22} strokeWidth={1.75} aria-hidden />
        ) : mode === "invalid" ? (
          <FileExclamationPoint size={22} strokeWidth={1.75} aria-hidden />
        ) : (
          <Upload size={22} strokeWidth={1.75} aria-hidden />
        )}
      </span>
      <span className="flex w-full flex-col gap-[7px]">
        <span className="text-[14px] break-words text-ink">{title}</span>
        <span className="text-[12px] leading-[1.5] break-words text-muted">{detail}</span>
      </span>
      <button
        type="button"
        className={`inline-flex items-center gap-[7px] rounded-md border bg-surface px-[14px] py-2 text-[12px] text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
          mode === "hover" || mode === "drag" ? "border-indigo-line" : "border-hairline"
        }`}
      >
        {action}
        {mode === "ready" ? <RefreshCw size={12} strokeWidth={1.75} aria-hidden /> : null}
      </button>
      <p
        id="syllabus-hint"
        role={mode === "invalid" ? "alert" : undefined}
        className={`text-[11px] leading-[1.4] ${mode === "invalid" ? "text-error" : "text-muted"}`}
      >
        {hint}
      </p>
    </div>
  )
}
