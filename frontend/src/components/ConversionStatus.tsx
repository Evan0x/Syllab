import { Check, Download, LoaderCircle, TriangleAlert, Upload } from "lucide-react"
import { Button } from "./Button.tsx"

type ConversionStatusProps = {
  courseName: string
  termLabel: string
} & (
  | { phase: "loading"; onCancel: () => void }
  | {
      phase: "success"
      filename: string
      onDownload: () => void
      onReset: () => void
    }
  | {
      phase: "error"
      message: string
      onReplace: () => void
      onRetry: () => void
    }
)

export function ConversionStatus(props: ConversionStatusProps) {
  const title =
    props.phase === "loading"
      ? "Building your calendar"
      : props.phase === "success"
        ? "Your semester is ready."
        : errorTitle(props.message)

  const symbolClass =
    props.phase === "success"
      ? "bg-success-soft text-success"
      : props.phase === "error"
        ? "bg-error-soft text-error"
        : "bg-indigo-soft text-indigo"

  return (
    <div
      className="flex flex-col gap-5 p-6"
      role={props.phase === "error" ? "alert" : "status"}
      aria-live="polite"
      aria-busy={props.phase === "loading"}
    >
      <div className="flex items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${symbolClass}`}>
          {props.phase === "loading" ? (
            <LoaderCircle size={20} strokeWidth={1.75} className="animate-spin" aria-hidden />
          ) : props.phase === "success" ? (
            <Check size={20} strokeWidth={1.75} aria-hidden />
          ) : (
            <TriangleAlert size={20} strokeWidth={1.75} aria-hidden />
          )}
        </span>
        <h2 className="text-[18px] text-ink">{title}</h2>
      </div>
      <p className="text-[13px] leading-[1.6] text-muted">
        {props.courseName}
        {props.termLabel ? (
          <>
            <br />
            {props.termLabel}
          </>
        ) : null}
      </p>
      {props.phase === "loading" ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] text-ink">Finding assignments and exams</p>
          <div className="h-[5px] overflow-hidden rounded-[3px] bg-well">
            <div className="progress-indeterminate h-[5px] rounded-[3px] bg-indigo" />
          </div>
          <p className="text-[12px] leading-[1.5] text-muted">This usually takes less than a minute.</p>
        </div>
      ) : (
        <p className="text-[13px] leading-[1.55] text-muted">
          {props.phase === "success"
            ? `${props.filename} downloaded. Import the .ics file into Google Calendar, Apple Calendar, or Outlook.`
            : props.message}
        </p>
      )}
      {props.phase === "loading" ? (
        <Button icon={LoaderCircle} disabled spinIcon>
          Generating calendar…
        </Button>
      ) : props.phase === "success" ? (
        <Button icon={Download} onClick={props.onDownload}>
          Download .ics
        </Button>
      ) : (
        <Button icon={Upload} onClick={props.onReplace}>
          Upload another PDF
        </Button>
      )}
      <button
        type="button"
        onClick={
          props.phase === "loading"
            ? props.onCancel
            : props.phase === "success"
              ? props.onReset
              : props.onRetry
        }
        className="text-center text-[12px] text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
      >
        {props.phase === "loading"
          ? "Cancel conversion"
          : props.phase === "success"
            ? "Start another course"
            : "Try this file again"}
      </button>
    </div>
  )
}

function errorTitle(message: string): string {
  if (/scanned pdf/i.test(message)) {
    return "We couldn’t read this PDF"
  }
  return "We couldn’t create your calendar"
}
