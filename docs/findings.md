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
- Test syllabi that use bare "Week N" dates before deciding whether
  RelativeDateResolver should own the date calculation.


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
- Test syllabi that use bare "Week N" dates before deciding whether
  RelativeDateResolver should own the date calculation.