Early-stage demo, under active development.

# SyllaCal

SyllaCal takes a course syllabus PDF, lets you review the extracted dates, and downloads an `.ics` calendar of assignments, quizzes, and exams.

## Demo

[syllacal.mov](

https://github.com/user-attachments/assets/5e1b23e3-cfa0-4106-89bb-6b0eef898571

)

## Features

- Upload a PDF, a course name, and a term start and end date.
- The upload is checked as a PDF by its `%PDF-` header, not by the file name. Files over 10 MB are rejected.
- Text is extracted with Apache PDFBox. Pages are separated by a blank line.
- Encrypted PDFs are rejected. A PDF with fewer than 200 characters of extracted text is rejected as a likely scan.
- The text is sent to the Gemini API. The response is parsed as JSON events with a title, type, date, start time, end time, location, weight, confidence, and a short source quote.
- Events with no date are dropped. Events with the same title and date are merged.
- The review page shows the course name, the semester from the form, and the events grouped by month. You can edit, add, and delete events before download. A missing time, location, or weight is shown as "Not specified". Confidence is shown when the API returns it, and a low-confidence event is highlighted.
- Export sends the reviewed list to the server and downloads an `.ics` file. It does not call Gemini again and does not reread the PDF. An event with no time is all-day. An event with a time is stored in `America/New_York`. An end time is included when it is later than the start. A location is included when one is present. The description includes the weight when one is present.

## How it works

The React app posts the file and the form fields to `POST /api/syllabus/preview`. The server then:

1. Extracts text from the PDF.
2. Asks Gemini for structured events. The prompt includes the term start and end, and asks the model to turn phrases such as "Week 5 Friday" into a date. It also asks for an end time and a location, and tells the model to leave the weight empty when the syllabus gives more than one weighting for the same item. The model is called through the `EventExtractor` interface. `GeminiEventExtractor` is the only implementation. HTTP 429 and 5xx responses are retried. `RelativeDateResolver` can turn "Week N Friday" into a date, but this step does not call it.
3. Runs `EventValidator`. That step drops undated events and merges duplicate title-and-date pairs. It does not remove events that fall outside the term, and it does not remove events the model marks as low confidence. Those cases are returned as warnings and shown on the review page.
4. Returns JSON with `courseName`, `events`, and `warnings`. Each event has `title`, `type`, `date`, `time`, `endTime`, `location`, `weightPercent`, and `confidence`. The source quote is not included in this response.

Reviewed events stay in the browser. `POST /api/syllabus/export` accepts JSON with `courseName` and `events`, builds the calendar with `IcsBuilder`, and returns `text/calendar`. The submitted list is used as given: the validator does not drop or merge events on this path. A blank title, a missing date, an end time without a start time, or an end time that is not after the start time is rejected. The server attachment name is `syllacal.ics`. The browser saves the file from the course name, such as `HIST-125-calendar.ics`.

`POST /api/syllabus` still accepts the same multipart upload and returns an `.ics` file in one step. The page does not call it.

## Tech stack

- Java 21
- Spring Boot 4.1.2
- Apache PDFBox 3.0.8
- Gemini `generateContent` API, called with Spring `RestClient` (configured model: `gemini-3.5-flash-lite`)
- ical4j 4.4.0
- React 19, TypeScript, and Vite, styled with Tailwind CSS

The API is the Maven project in `backend/`. The page is in `frontend/`.

## Run locally

Java 21 is required. From the repository root:

```bash
cd backend
export GEMINI_API_KEY=your-key
./mvnw spring-boot:run
```

The API listens on http://localhost:8080. It does not serve a page. The key is read from the environment. It is not stored in the repo.

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to http://localhost:8080. While the preview request is in progress, the page says "Building your calendar".

## Known limitations

- Results on real syllabi are in `docs/findings.md`.
- Scanned syllabi are rejected. There is no OCR.
- The preview request waits on the Gemini call.
- Timed events always use `America/New_York`. The form has no timezone field.
- The prompt assumes the term starts on a Monday. The form does not check that.
- Relative dates on the preview path are only interpreted by the model. `RelativeDateResolver` is implemented and tested, and it is not called from `POST /api/syllabus/preview`. Syllabi checked so far do not write deadlines as "Week N Friday".
- The preview path does not use `Term`.
- The model may return a source quote, but the preview JSON omits it, so the review page cannot show the quote.

## Roadmap

- User accounts and saved calendars
- OCR for scanned PDFs
- Asynchronous extraction, so the page does not wait on the model call
- Cloud deployment. `backend/Dockerfile` and `k8s/` are unused sketches
- Reminders
- Call `RelativeDateResolver` from the preview path if a syllabus needs it
- Return the source quote in the preview, and let the user choose the timezone used for timed events
