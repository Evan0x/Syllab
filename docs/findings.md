# Findings: Gemini extraction on real syllabi

Tested on 3 syllabus so far (target: 3-5), Oct 29, 2026.
Model: gemini-3.5-flash-lite.
Term start and end dates were entered manually for each run.

Counting rules: only items with an explicit date or a stated rule count.
Categories are tracked separately because they fail in different ways: explicit dates,
table-derived dates (week row + weekday column), administrative dates, recurring
events, and relative dates (derived from a rule, e.g. "Week N" or
"the Sunday before the Monday recitation").

## Results

| Course | Category | In syllabus | Correct | Missed | Wrong date | Notes |
|---|---|---|---|---|---|---|
| MATH 125 | Explicit dates | 2 | 2 | 0 | 0 | Midterm and final: date, start time and time zone correct |
| MATH 125 | Recurring | 2 | 0 | 2 | n/a | Weekly quiz and weekly homework produced no events |
| MATH 125 | Relative dates | 0 | n/a | n/a | n/a | Syllabus has no "Week N" dates |
| MATH 114 | Explicit dates | 1 | 1 | 0 | 0 | Final exam: date, 7:30 start and time zone correct; 10:15 end time lost |
| MATH 114 | Table-derived | 2 | 2 | 0 | 0 | Exams 1 and 2 read from a week-by-week table; weights (20%) correct |
| MATH 114 | Administrative dates | 3 | 0 | 3 | n/a | Three drop deadlines not extracted (scope decision pending) |
| MATH 114 | Recurring | 0 | n/a | n/a | n/a | No stated weekly deadline pattern |
| MATH 114 | Relative dates | 0 | n/a | n/a | n/a | Every week row in the table includes its date range |
| HIST 125 | Explicit dates | 7 | 4 | 3 | 0 | Map quiz, midterm, in-class essay, final extracted with correct weights; 3 viewing-guide submissions missed |
| HIST 125 | Administrative dates | 4 | 0 | 4 | n/a | Add deadline and three withdrawal deadlines not extracted |
| HIST 125 | Relative dates | 8 | 0 | 8 | n/a | Reaction paper deadlines ("Sunday before the Monday recitation") skipped; students submit only 2 of 8 |
| HIST 125 | Recurring | 0 | n/a | n/a | n/a | No stated weekly deadline pattern |

Among the 9 events the model did return across the three syllabi, 0 had a wrong date.

## Failure patterns


# Findings: Gemini extraction on real syllabi

Tested on 3 syllabi so far (target: 3-5), Oct 29, 2026.
Model: [copy the exact name from application.yml].
Term start and end dates were entered manually for each run.

Counting rules: only items with an explicit date or a stated rule count.
Categories are tracked separately because they fail in different ways: explicit dates,
table-derived dates (week row + weekday column), administrative dates, recurring
events, and relative dates (derived from a rule, e.g. "Week N" or
"the Sunday before the Monday recitation").

## Results

| Course | Category | In syllabus | Correct | Missed | Wrong date | Notes |
|---|---|---|---|---|---|---|
| MATH 125 | Explicit dates | 2 | 2 | 0 | 0 | Midterm and final: date, start time and time zone correct |
| MATH 125 | Recurring | 2 | 0 | 2 | n/a | Weekly quiz and weekly homework produced no events |
| MATH 125 | Relative dates | 0 | n/a | n/a | n/a | No "Week N" dates in this syllabus |
| MATH 114 | Explicit dates | 1 | 1 | 0 | 0 | Final exam: date, 7:30 start and time zone correct; 10:15 end time lost |
| MATH 114 | Table-derived | 2 | 2 | 0 | 0 | Exams 1 and 2 read from a week-by-week table; weights (20%) correct |
| MATH 114 | Administrative dates | 3 | 0 | 3 | n/a | Three drop deadlines not extracted (scope decision pending) |
| MATH 114 | Recurring | 0 | n/a | n/a | n/a | No stated weekly deadline pattern |
| MATH 114 | Relative dates | 0 | n/a | n/a | n/a | Every week row in the table includes its date range |
| HIST 125 | Explicit dates | 7 | 4 | 3 | 0 | Map quiz, midterm, in-class essay, final extracted with correct weights; 3 viewing-guide submissions missed |
| HIST 125 | Administrative dates | 4 | 0 | 4 | n/a | Add deadline and three withdrawal deadlines not extracted |
| HIST 125 | Relative dates | 8 | 0 | 8 | n/a | Reaction paper deadlines ("Sunday before the Monday recitation") skipped; students submit only 2 of 8 |
| HIST 125 | Recurring | 0 | n/a | n/a | n/a | No stated weekly deadline pattern |

Among the 9 events the model did return across the three syllabi, 0 had a wrong date.

## Failure patterns

- **Recall is the main weakness so far, not date arithmetic.** Every returned event is
  an exam, quiz or essay. Submission-type deliverables (viewing guides), derived
  deadlines and administrative dates were never returned.
- **Recurring events are dropped.** MATH 125 says quizzes happen every Thursday with no
  dates listed; the model returned nothing. The pipeline has no recurrence support.
- **End time is lost.** All timed events in the three syllabi give a time range, but the
  event record has no end time field, so the calendar event has only a start.
- **Location is lost.** The HIST 125 final is in a different room than lecture, and the
  syllabus flags it. The source snippet stops before the room, so it is not in the event at all.
- **In-class events are exported as all-day.** The HIST 125 midterm and map quiz happen
  in lecture (Wed 3:00-4:15 pm), and the MATH 114 exams in class (MW 8:30-10:20). The
  class time is in the syllabus but was not used.
- **Administrative dates are skipped** in both syllabi that list them (7 dates). Whether
  this counts as a miss depends on whether the product should cover university deadlines.
- **Rule-derived dates are skipped.** The 8 reaction paper candidates were not produced,
  so the model's ability to compute a date from a rule is untested.
- **Table-style schedules:** handled correctly in 1 syllabus (2 of 2 events). Too small a
  sample to conclude anything; the table was clean and each week row carried its date range.
- **Relative dates ("Week 5 Friday"):** not observed yet. No syllabus so far requires
  computing a date from a bare week number, so RelativeDateResolver is untested on real data.
- **Hallucinated dates:** none observed in 3 syllabi.
- **Duplicates:** not observed yet.

## Round 1: prompt and schema change (deliverables, end time, location)

Changes: the prompt now asks for all dated deliverables, not only exams; added
end_time and location to the prompt, response schema and event record; IcsBuilder
writes DTEND and LOCATION.
Status: HIST 125 rerun through the app; MATH 125 and MATH 114 not rerun yet.

| Course | Explicit dates before | After | Newly correct | Newly wrong |
|---|---|---|---|---|
| HIST 125 | 4 of 7 | 7 of 7 | 3 viewing guides | 0 |
| MATH 125 | not rerun yet | | | |
| MATH 114 | not rerun yet | | | |

Verified in the generated .ics (HIST 125): the final exam has DTEND (16:15) and
LOCATION (Exploratory Hall L004) in the same time zone as DTSTART.

Observations:
- Output is not fully stable across runs. In one run the midterm title was
  "In-class Midterm", in another "Midterm Exam". Because the UID is derived from the
  title, its UID changed, so re-importing would create a duplicate calendar entry.
- Location for the in-lecture events (map quiz, midterm) appeared in one run's raw
  output but not in the .ics from a later run. [Fill in after checking which it is.]
- DESCRIPTION is cut at 200 characters, sometimes mid-sentence.

Caveat: the prompt was tuned while looking at HIST 125, so this result is optimistic.
A held-out syllabus is still needed.

## What I changed because of this

- [Only if true: timed events now use the term time zone (America/New_York)
  instead of UTC.]

## Open problems

- Check whether the extraction prompt is steering the model toward exams only;
  re-run the three syllabi after changing it and compare recall.
- Add end time and location fields to the extracted event.
- Support recurring events (generate from the term range, or use RRULE).
- Decide whether administrative dates (drop deadlines) are in scope.
- Decide how to handle "submit 2 of 8" deadlines (export all candidates, or let the user pick).
- Events held in class are exported as all-day. Decide whether to default to the class
  meeting time when the syllabus states one.
- Bare "Week N" dates: searched, not found. `RelativeDateResolver` stays out of the upload path. See below.

## Week N Friday search (Nov 1, 2026)

Question: does any real syllabus write a deadline as "Week N Friday" (or "Wk N Fri", "Friday of Week N"), with no calendar date next to it? That is the only phrase `resolve()` can turn into a date. If none do, wiring it into `POST /api/syllabus` does not change what users get.

Text extracted with PDFBox from the local files, then read for week-number schedules.

| Syllabus | What the schedule actually says | "Week N" + weekday, no date |
|---|---|---|
| MATH 114 (F26) | Week rows already include the range, e.g. `6 (9/28-30) … Exam 1` | No |
| MATH 125 (F26), `Syll.pdf` | `Midterm (MT): Thursday, October 15`; homework "each week on Thursdays" | No |
| HIST 125 (F26) ver03 | `the Sunday before the Monday recitation`; exams have calendar dates | No |
| CS 211 (F26) schedule | `Week` column plus `Start Date` (`Aug 25`) and `Due: Sep 8` | No |
| SOAN 102 (Sp26) | Week number and a month/day on the same row (`3/20 MIDTERM EXAM`) | No |
| CSC 202 (2025-26) | Same: week number beside `February 4`, `March 10` | No |
| GEOL 101 (F25) | `Week of 9/1`; `EXAM 1, Wed. 10/1` | No |
| FYI 100/101 (F25) | Calendar dates on each day. One line says homework is "due in Week 7", with no weekday | No |

Eight syllabi, zero "Week N Friday" deadlines. The closest line is FYI's "due in Week 7". `resolve()` requires a weekday after the number, so that line would still come back empty.

Decision: do not call `resolve()` from the upload path. The prompt already asks the model to convert "Week 5 Friday". Nothing in this set gives the Java resolver a date to fix.