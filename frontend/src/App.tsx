import { useEffect, useState } from "react"
import { currentAccount, logoutAccount, type Account } from "./api/auth.ts"
import type { PreviewResponse } from "./api/syllabus.ts"
import { privacyDocument, termsDocument } from "./content/legal.ts"
import { AuthPage } from "./pages/AuthPage.tsx"
import { CoursesPage } from "./pages/CoursesPage.tsx"
import { GuestUpgradePage } from "./pages/GuestUpgradePage.tsx"
import { LandingPage } from "./pages/LandingPage.tsx"
import { LegalDocumentPage } from "./pages/LegalDocumentPage.tsx"
import { ReviewCalendarPage } from "./pages/ReviewCalendarPage.tsx"
import { SavedCalendarPage } from "./pages/SavedCalendarPage.tsx"
import { AdvisorPage } from "./pages/AdvisorPage.tsx"
import { WorkloadPage } from "./pages/WorkloadPage.tsx"

type ReviewTerm = {
  termStart: string
  termEnd: string
}

type ExistingCourse = {
  id: string
  courseName: string
  termStart: string
  termEnd: string
}

function readReupload(): ExistingCourse | null {
  try {
    const stored = sessionStorage.getItem("reupload")
    if (!stored) return null
    sessionStorage.removeItem("reupload")
    const parsed: unknown = JSON.parse(stored)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "courseName" in parsed &&
      typeof (parsed as Record<string, unknown>).id === "string" &&
      typeof (parsed as Record<string, unknown>).courseName === "string"
    ) {
      return parsed as ExistingCourse
    }
  } catch {}
  return null
}

function legalDocument() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  if (path === "/terms") {
    return termsDocument
  }
  if (path === "/privacy") {
    return privacyDocument
  }
  return null
}

export default function App() {
  const legal = legalDocument()
  const [account, setAccount] = useState<Account | null | undefined>(undefined)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [term, setTerm] = useState<ReviewTerm | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [existingCourse] = useState<ExistingCourse | null>(readReupload)
  const [existingCourseId, setExistingCourseId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    currentAccount()
      .then((next) => {
        if (active) {
          setAccount(next)
        }
      })
      .catch(() => {
        if (active) {
          setAccount(null)
        }
      })
    return () => {
      active = false
    }
  }, [])

  async function onLogout() {
    try {
      await logoutAccount()
    } catch {
      // The session is cleared locally even if the request fails.
    }
    setPreview(null)
    setTerm(null)
    setReviewing(false)
    setExistingCourseId(null)
    setAccount(null)
  }

  if (legal) {
    return <LegalDocumentPage document={legal} />
  }

  if (account === undefined) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="site-header h-[83px] border-b border-hairline" />
        <div className="mx-auto w-full max-w-[960px] px-5 pt-10">
          <div className="h-3 w-16 rounded bg-well" />
          <div className="mt-3 h-6 w-48 rounded bg-well" />
          <div className="mt-2 h-4 w-72 max-w-full rounded bg-well" />
          <div className="panel mt-8 h-40" />
        </div>
      </div>
    )
  }

  if (account === null) {
    return <AuthPage onAuthenticated={setAccount} />
  }

  const path = window.location.pathname.replace(/\/+$/, "")
  const sharedProps = { email: account.email, onLogout: () => { void onLogout() }, isGuest: account.isGuest }

  if (path === "/courses") {
    return <CoursesPage {...sharedProps} />
  }

  if (path === "/calendar") {
    return <SavedCalendarPage {...sharedProps} />
  }

  if (path === "/workload") {
    return <WorkloadPage {...sharedProps} />
  }

  if (path === "/advisor") {
    return <AdvisorPage {...sharedProps} />
  }

  if (account.isGuest && account.trialsUsed >= 2 && !reviewing) {
    return (
      <GuestUpgradePage
        email={account.email}
        onLogout={() => { void onLogout() }}
      />
    )
  }

  return (
    <>
      <div hidden={reviewing}>
        <LandingPage
          email={account.email}
          onLogout={() => {
            void onLogout()
          }}
          existingCourse={existingCourse}
          isGuest={account.isGuest}
          trialsUsed={account.trialsUsed}
          onPreview={(result, nextTerm, courseId) => {
            setPreview(result)
            setTerm(nextTerm)
            setExistingCourseId(courseId ?? null)
            setReviewing(true)
            void currentAccount().then((next) => { if (next) setAccount(next) })
          }}
        />
      </div>
      {reviewing ? (
        <ReviewCalendarPage
          preview={preview}
          term={term}
          existingCourseId={existingCourseId}
          email={account.email}
          isGuest={account.isGuest}
          onLogout={() => {
            void onLogout()
          }}
          onBack={() => {
            setReviewing(false)
            setExistingCourseId(null)
          }}
        />
      ) : null}
    </>
  )
}
