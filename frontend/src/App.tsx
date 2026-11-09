import { useEffect, useState } from "react"
import { currentAccount, logoutAccount, type Account } from "./api/auth.ts"
import type { PreviewResponse } from "./api/syllabus.ts"
import { AuthPage } from "./pages/AuthPage.tsx"
import { LandingPage } from "./pages/LandingPage.tsx"
import { ReviewCalendarPage } from "./pages/ReviewCalendarPage.tsx"

type ReviewTerm = {
  termStart: string
  termEnd: string
}

export default function App() {
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

  if (account === undefined) {
    return <main className="min-h-screen bg-canvas" />
  }

  if (account === null) {
    return <AuthPage onAuthenticated={setAccount} />
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
