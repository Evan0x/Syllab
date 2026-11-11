import { useEffect, useRef } from "react"

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = "confirm-dialog-title"

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="review-dialog w-full max-w-[400px]"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="panel flex flex-col gap-4 p-5 shadow-float">
        <h2 id={titleId} className="text-[15px] font-medium tracking-[-0.01em] text-ink">
          {title}
        </h2>
        <p className="text-[13px] leading-5 text-muted">{message}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md px-3 text-[13px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 rounded-md bg-error px-3.5 text-[13px] font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
