import { useEffect, useState } from "react"
import { currentAccount, logoutAccount, type Account } from "./api/auth.ts"
import type { PreviewResponse } from "./api/syllabus.ts"
import { privacyDocument, termsDocument } from "./content/legal.ts"
import { AuthPage } from "./pages/AuthPage.tsx"
import { LandingPage } from "./pages/LandingPage.tsx"
import { LegalDocumentPage } from "./pages/LegalDocumentPage.tsx"
import { ReviewCalendarPage } from "./pages/ReviewCalendarPage.tsx"
import { SavedCalendarPage } from "./pages/SavedCalendarPage.tsx"
import { WorkloadPage } from "./pages/WorkloadPage.tsx"

type ReviewTerm = {
  termStart: string
  termEnd: string
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
    setAccount(null)
  }

  if (legal) {
    return <LegalDocumentPage document={legal} />
  }

  if (account === undefined) {
    return <main className="min-h-screen bg-canvas" />
  }

  if (account === null) {
    return <AuthPage onAuthenticated={setAccount} />
  }

  if (window.location.pathname.replace(/\/+$/, "") === "/calendar") {
    return (
      <SavedCalendarPage
        email={account.email}
        onLogout={() => {
          void onLogout()
        }}
      />
    )
  }

  if (window.location.pathname.replace(/\/+$/, "") === "/workload") {
    return (
      <WorkloadPage
        email={account.email}
        onLogout={() => {
          void onLogout()
        }}
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
          email={account.email}
          onLogout={() => {
            void onLogout()
          }}
          onBack={() => setReviewing(false)}
        />
      ) : null}
    </>
  )
}
