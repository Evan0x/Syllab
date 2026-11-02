import { useState } from "react"
import type { PreviewResponse } from "./api/syllabus.ts"
import { LandingPage } from "./pages/LandingPage.tsx"
import { ReviewCalendarPage } from "./pages/ReviewCalendarPage.tsx"

type ReviewTerm = {
  termStart: string
  termEnd: string
}

export default function App() {
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [term, setTerm] = useState<ReviewTerm | null>(null)
  const [reviewing, setReviewing] = useState(false)

  return (
    <>
      <div hidden={reviewing}>
        <LandingPage
          onPreview={(result, nextTerm) => {
            setPreview(result)
            setTerm(nextTerm)
            setReviewing(true)
          }}
        />
      </div>
      {reviewing ? (
        <ReviewCalendarPage
          preview={preview}
          term={term}
          onBack={() => setReviewing(false)}
        />
      ) : null}
    </>
  )
}
