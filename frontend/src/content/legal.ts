export type LegalSection = {
  heading: string
  paragraphs: string[]
  review?: string
}

export type LegalDocument = {
  title: string
  summary: string
  sections: LegalSection[]
}

const notice =
  "This page describes the Syllapin application as implemented on November 10, 2026. It is not a claim that Syllapin meets any privacy or consumer law. A paragraph marked Needs review is not decided by the code and is not a promise."

export const termsDocument: LegalDocument = {
  title: "Terms of Service",
  summary: notice,
  sections: [
    {
      heading: "The service",
      paragraphs: [
        "Syllapin is a web application that turns a course syllabus PDF into a list of dated events and a downloadable calendar file. A signed-in person uploads a PDF, enters a course name and the first and last day of the term, reviews the events in the browser, and can download an .ics file.",
        "The screens do not ask a person to accept these terms, and the application does not record that acceptance.",
      ],
    },
    {
      heading: "Accounts",
      paragraphs: [
        "A password account stores an email address and a bcrypt hash of the password. The password itself is not stored. The password must be at least 10 characters. The email is stored after surrounding spaces are removed and the address is lowercased.",
        "Creating a password account also creates a verification code. The code is 32 hexadecimal characters produced from 16 random bytes. The database stores a SHA-256 hash of the code, an expiry time, and, after a successful check, the time it was used. The code expires 15 minutes after it is created and can be used once. Password sign-in is refused until a valid code is accepted. Registering does not start a session.",
        "If a mail host and a from address are configured, Syllapin sends the code in a plain-text email. The message contains the code and the 15-minute expiry. It does not contain the password. If those mail settings are absent, the account is still created and no email is sent. The application does not log that message.",
        "Google sign-in continues only when Google marks the email as verified. GitHub sign-in continues only when GitHub returns a verified email. The application prefers the address GitHub marks as both primary and verified, and otherwise uses another verified address. If the provider does not confirm a verified email, that attempt does not create or change an account.",
        "The same verified email is the same account, including an account that already has a password. An account created only through Google or GitHub has no password hash, and password sign-in does not succeed for it.",
        "The account row stores an id, the email, the password hash or no hash, whether the email is verified, and the time the row was created. It does not store a Google or GitHub user id, name, or profile photo.",
      ],
    },
    {
      heading: "Sessions",
      paragraphs: [
        "Sign-in creates a session in the server process and sends a session cookie. The cookie is HttpOnly and SameSite Lax. Outside the local development profile it is also marked Secure. The session holds the account id and email, with the password hash removed. Logout invalidates the session.",
        "A second cookie, XSRF-TOKEN, is set so the page can send a matching header on requests that change data. That cookie is readable by the page.",
        "The application does not set a session lifetime and does not store sessions in the database. A restart of the server process drops the in-memory sessions.",
      ],
      review:
        "The exact lifetime used by the server framework is not set in this application's configuration.",
    },
    {
      heading: "Syllabi and calendars",
      paragraphs: [
        "The upload must be a PDF of at most 10 MB and must begin with the PDF file signature. Syllapin extracts the text with Apache PDFBox. Processing stops when the PDF is encrypted or the extracted text is shorter than 200 characters. The application does not run optical character recognition.",
        "The extracted text, together with the term start and term end, is sent to Google's Gemini API at generativelanguage.googleapis.com. The configured model name is gemini-3.5-flash-lite. The course name and the account email are not added as separate fields. If the syllabus text itself contains a name, an email address, or other personal information, that text is part of the request. When Gemini responds with HTTP 429 or a server error, the same request can be sent again, up to three further attempts.",
        "The preview stays in the browser. Downloading the calendar sends the edited events back to Syllapin, which builds an .ics file and does not call Gemini again. The file uses the America/New_York time zone. The browser saves it under a name taken from the course name. A quote from the syllabus can be included in an event description.",
        "The upload and export handlers do not write the PDF, the extracted text, the course, or the events to the database. The database does have tables that could hold courses, syllabus records, and events. Separate event endpoints can read, rename, confirm, or delete an event row owned by the signed-in account if a row exists. The current upload flow does not create those rows.",
      ],
    },
    {
      heading: "Ending an account",
      paragraphs: [
        "An authenticated request to delete the current account removes that account row and invalidates the session. Verification-code rows are removed with the account by a database rule. Course, syllabus, and event rows for that account would be removed by the same kind of rule. The current screens do not send this delete request.",
      ],
      review:
        "There is no on-screen control for deletion, and the code does not name the operator, a contact address, a governing law, or a liability limit.",
    },
  ],
}

export const privacyDocument: LegalDocument = {
  title: "Privacy Policy",
  summary: notice,
  sections: [
    {
      heading: "Account information",
      paragraphs: [
        "A password account collects the email address and password entered on the registration form. Syllapin stores the email and a bcrypt hash of the password. It does not store the password. It also stores an account id, whether the email has been verified, and the time the account was created.",
        "The verification code is stored only as a SHA-256 hash, with an expiry time and, after use, a used-at time. The application does not delete those rows when the 15 minutes pass or when the code is used. They are removed when the account row is deleted.",
        "Google sign-in asks Google for the openid, profile, and email scopes. Syllapin uses the email address and Google's verified flag. GitHub sign-in asks GitHub for the user and the user's email addresses. The server then requests https://api.github.com/user/emails with the access token from that sign-in and reads which addresses are verified and which is primary. One verified address is stored. The account table does not store the access token, the other addresses, a provider user id, a name, or a photo.",
      ],
      review:
        "The sign-in handler does not contain a step that removes a provider access token from the server session. Google and GitHub may keep their own records of the sign-in. This application does not describe those records.",
    },
    {
      heading: "Syllabus documents",
      paragraphs: [
        "The signed-in upload sends the PDF, the course name, and the term dates to the Syllapin server for that request. The PDF must be at most 10 MB. The server reads the file into memory and extracts its text. It does not write the PDF or the extracted text to the database, and it does not save the original file name.",
        "There is no deletion job for the uploaded file, because those handlers do not store it. The browser keeps the selected file and the preview until the person leaves that flow or replaces the file. The downloaded .ics file stays on the device that saved it.",
      ],
      review:
        "This does not describe copies kept by the host, the database service, a proxy, or Google after the text is sent. No retention period for those copies is set in the application.",
    },
    {
      heading: "Google Gemini",
      paragraphs: [
        "After text is extracted, Syllapin sends that text and the term start and end dates to Google's Gemini API. The request goes to generativelanguage.googleapis.com for the model named gemini-3.5-flash-lite. An API key is sent with the request. The key is not the person's account.",
        "The prompt asks the model for dated coursework and deadlines as JSON, including a short quote copied from the syllabus. The course name and the account password are not part of that request. The account email is not added separately. Text that already appears inside the syllabus is sent as part of the document text.",
        "A scanned or encrypted PDF that fails text extraction is not sent. A retryable Gemini error can cause the same text to be sent up to three more times during that upload.",
      ],
      review:
        "The application does not set or receive a retention period from Google for this text.",
    },
    {
      heading: "Email",
      paragraphs: [
        "Verification email is sent only when a mail host and a from address are configured for the server. The message goes to the address on the account and contains the verification code and the expiry. The mail vendor is whichever host that deployment configures. The application does not name one.",
      ],
      review: "The application does not control how long that mail host keeps the message.",
    },
    {
      heading: "Fonts",
      paragraphs: [
        "The pages load Inter and Instrument Serif from Google Fonts. The browser requests those files from fonts.googleapis.com and fonts.gstatic.com. Syllapin does not receive a copy of that request.",
      ],
    },
    {
      heading: "Cookies and sign-in attempts",
      paragraphs: [
        "The session cookie identifies the in-memory session. The XSRF-TOKEN cookie is used to check requests that change data. The application does not set analytics or advertising cookies.",
        "A failed password sign-in records the normalized email and the request's remote address in memory. Five failures in 15 minutes block further password attempts for that email or address. A successful sign-in clears the record for that email. These entries are not written to the database and are dropped when the process stops.",
        "The application does not include a payment, advertising, or data-sale feature.",
      ],
    },
    {
      heading: "Deletion",
      paragraphs: [
        "A signed-in client can request deletion of the current account. That request deletes the account row and invalidates the session. Database rules also remove verification codes for that account, and would remove course, syllabus, and event rows tied to it. The current screens do not offer this action.",
      ],
      review:
        "The code does not name a contact address, a legal entity, an age rule, or a legal basis for processing. It does not say where a particular deployment keeps the PostgreSQL database. Those points need a review before they are stated as policy.",
    },
  ],
}
