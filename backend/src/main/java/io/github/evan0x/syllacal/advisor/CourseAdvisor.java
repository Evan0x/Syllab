package io.github.evan0x.syllacal.advisor;

import io.github.evan0x.syllacal.workload.WorkloadCalculator;
import io.github.evan0x.syllacal.workload.WorkloadCalculator.BusyWeek;
import io.github.evan0x.syllacal.workload.WorkloadCalculator.Overlap;
import io.github.evan0x.syllacal.workload.WorkloadCalculator.Report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class CourseAdvisor {

	private static final int CARD_LIMIT = 8;
	private static final Set<String> TYPES = Set.of("ASSIGNMENT", "EXAM", "QUIZ", "PROJECT", "ADMIN", "OTHER");

	private CourseAdvisor() {
	}

	public record CourseInput(UUID id, String name, LocalDate termStart, LocalDate termEnd) {
	}

	public record EventInput(
			UUID id,
			UUID courseId,
			String title,
			String type,
			LocalDate date,
			LocalTime start,
			LocalTime end,
			String location,
			BigDecimal weight,
			String confidence,
			String quote) {
	}

	public record Analysis(
			LocalDate today,
			List<CourseBrief> courses,
			List<BusyWeekView> busyWeeks,
			List<OverlapView> overlaps,
			NextExam nextExam,
			Preparation preparation,
			List<NextExam> upcomingExams,
			List<NextExam> examsWithinTwoWeeks,
			List<String> missing) {
	}

	public record CourseBrief(
			UUID id,
			String name,
			LocalDate termStart,
			LocalDate termEnd,
			int assignments,
			int exams,
			int quizzes,
			int projects,
			int admin,
			int other,
			int upcoming,
			int weightsMissing,
			List<WeightNote> weights,
			int weightTotal,
			List<DeadlineNote> deadlines,
			int upcomingTotal,
			List<BusyWeekView> busyWeeks) {
	}

	public record WeightNote(UUID eventId, String title, LocalDate date, BigDecimal weight) {
	}

	public record DeadlineNote(
			UUID eventId,
			String title,
			String type,
			LocalDate date,
			LocalTime start,
			LocalTime end,
			String location,
			BigDecimal weight,
			String quote,
			String confidence) {
	}

	public record BusyWeekView(LocalDate start, LocalDate end, int events, List<String> reasons) {
	}

	public record OverlapView(LocalDate date, List<String> titles) {
	}

	public record NextExam(UUID eventId, UUID courseId, String courseName, String title, LocalDate date, String quote) {
	}

	public record Preparation(LocalDate examDate, int calendarDays, String note) {
	}

	public record Prompt(Analysis analysis, String text, Map<String, UUID> labels) {
	}

	public static Analysis analyze(LocalDate today, List<CourseInput> courses, List<EventInput> events) {
		List<CourseInput> courseList = cleanCourses(courses);
		List<EventInput> eventList = cleanEvents(events);
		Map<UUID, String> names = new LinkedHashMap<>();
		for (CourseInput course : courseList) {
			names.put(course.id(), courseName(course));
		}
		Report workload = workload(today, courseList, eventList);
		List<EventInput> exams = eventList.stream()
				.filter(event -> "EXAM".equals(typeOf(event)) && !event.date().isBefore(today))
				.sorted(eventOrder(names))
				.toList();
		NextExam nextExam = exams.isEmpty() ? null : nextExam(exams.getFirst(), names);
		LocalDate twoWeeks = today.plusDays(13);
		List<NextExam> soon = exams.stream()
				.filter(event -> !event.date().isAfter(twoWeeks))
				.map(event -> nextExam(event, names))
				.toList();
		List<CourseBrief> briefs = new ArrayList<>();
		for (CourseInput course : courseList) {
			List<EventInput> own = eventList.stream().filter(event -> course.id().equals(event.courseId())).toList();
			briefs.add(brief(today, course, own, names));
		}
		return new Analysis(
				today,
				List.copyOf(briefs),
				workload.busyWeeks().stream().map(CourseAdvisor::busy).toList(),
				workload.overlaps().stream().map(CourseAdvisor::overlap).toList(),
				nextExam,
				nextExam == null ? null : preparation(today, nextExam.date()),
				List.copyOf(exams.stream().map(event -> nextExam(event, names)).toList()),
				List.copyOf(soon),
				missing(eventList, nextExam));
	}

	public static Prompt prompt(LocalDate today, List<CourseInput> courses, List<EventInput> events) {
		List<CourseInput> courseList = cleanCourses(courses);
		List<EventInput> eventList = cleanEvents(events);
		Analysis analysis = analyze(today, courseList, eventList);
		Map<UUID, String> names = new LinkedHashMap<>();
		for (CourseInput course : courseList) {
			names.put(course.id(), courseName(course));
		}
		List<EventInput> ordered = eventList.stream().sorted(eventOrder(names)).toList();
		Map<String, UUID> labels = new LinkedHashMap<>();
		StringBuilder sheet = new StringBuilder();
		Report workload = workload(today, courseList, eventList);
		sheet.append(WorkloadCalculator.insightSheet(workload));
		sheet.append("Assignment rows below keep ASSIGNMENT and PROJECT separate. ");
		sheet.append("The workload lines above count projects with assignments.\n");
		for (String note : analysis.missing()) {
			sheet.append("Missing: ").append(note).append('\n');
		}
		if (analysis.preparation() != null) {
			sheet.append("Preparation: ").append(analysis.preparation().note()).append('\n');
		}
		for (Overlap overlap : workload.overlaps()) {
			sheet.append("Overlap ")
					.append(overlap.date())
					.append(": ")
					.append(String.join(" and ", overlap.titles()))
					.append('\n');
		}
		int index = 0;
		for (EventInput event : ordered) {
			if (event.id() == null) {
				continue;
			}
			String label = column(index++);
			labels.put(label, event.id());
			sheet.append("Label ").append(label)
					.append(" | course ").append(names.getOrDefault(event.courseId(), "Untitled course"))
					.append(" | title ").append(singleLine(event.title(), "Untitled event"))
					.append(" | type ").append(typeOf(event))
					.append(" | date ").append(event.date());
			if (event.start() != null) {
				sheet.append(" | time ").append(event.start());
				if (event.end() != null) {
					sheet.append('-').append(event.end());
				}
			} else {
				sheet.append(" | time none");
			}
			sheet.append(" | location ").append(event.location() == null ? "none" : singleLine(event.location(), "none"));
			sheet.append(" | weight ");
			if (event.weight() == null) {
				sheet.append("not specified");
			} else {
				sheet.append(event.weight().stripTrailingZeros().toPlainString());
			}
			sheet.append(" | confidence ").append(event.confidence() == null ? "none" : event.confidence());
			sheet.append(" | quote ").append(event.quote() == null ? "none" : singleLine(event.quote(), "none"));
			sheet.append('\n');
		}
		return new Prompt(analysis, sheet.toString(), Map.copyOf(labels));
	}

	public static String userText(String facts, String question, List<String> earlierTurns) {
		StringBuilder text = new StringBuilder();
		text.append("FACTS\n").append(facts).append("\nQUESTION\n").append(question);
		if (earlierTurns != null && !earlierTurns.isEmpty()) {
			text.append("\nEARLIER TURNS\n");
			for (String turn : earlierTurns) {
				text.append(turn).append('\n');
			}
		}
		return text.toString();
	}

	private static CourseBrief brief(LocalDate today, CourseInput course, List<EventInput> own, Map<UUID, String> names) {
		List<EventInput> upcoming = own.stream()
				.filter(event -> !event.date().isBefore(today))
				.sorted(eventOrder(names))
				.toList();
		List<WeightNote> weights = own.stream()
				.filter(event -> event.weight() != null)
				.sorted(eventOrder(names))
				.map(event -> new WeightNote(event.id(), singleLine(event.title(), "Untitled event"), event.date(), event.weight().stripTrailingZeros()))
				.toList();
		List<DeadlineNote> deadlines = upcoming.stream().map(CourseAdvisor::deadline).toList();
		Report workload = workload(today, List.of(course), own);
		return new CourseBrief(
				course.id(),
				courseName(course),
				course.termStart(),
				course.termEnd(),
				count(own, "ASSIGNMENT"),
				count(own, "EXAM"),
				count(own, "QUIZ"),
				count(own, "PROJECT"),
				count(own, "ADMIN"),
				(int) own.stream().filter(event -> "OTHER".equals(typeOf(event))).count(),
				upcoming.size(),
				(int) own.stream().filter(event -> event.weight() == null).count(),
				weights.stream().limit(CARD_LIMIT).toList(),
				weights.size(),
				deadlines.stream().limit(CARD_LIMIT).toList(),
				deadlines.size(),
				workload.busyWeeks().stream().map(CourseAdvisor::busy).toList());
	}

	private static DeadlineNote deadline(EventInput event) {
		return new DeadlineNote(
				event.id(),
				singleLine(event.title(), "Untitled event"),
				typeOf(event),
				event.date(),
				event.start(),
				event.end(),
				event.location() == null ? null : singleLine(event.location(), ""),
				event.weight() == null ? null : event.weight().stripTrailingZeros(),
				event.quote() == null ? null : singleLine(event.quote(), ""),
				event.confidence());
	}

	private static NextExam nextExam(EventInput event, Map<UUID, String> names) {
		return new NextExam(
				event.id(),
				event.courseId(),
				names.getOrDefault(event.courseId(), "Untitled course"),
				singleLine(event.title(), "Untitled event"),
				event.date(),
				event.quote() == null ? null : singleLine(event.quote(), ""));
	}

	private static Preparation preparation(LocalDate today, LocalDate examDate) {
		int days = (int) ChronoUnit.DAYS.between(today, examDate) + 1;
		String note = "There are " + days + " calendar days from today through " + examDate
				+ ". The calendar does not record which of those days are free.";
		return new Preparation(examDate, days, note);
	}

	private static List<String> missing(List<EventInput> events, NextExam nextExam) {
		List<String> notes = new ArrayList<>();
		notes.add("The original syllabus file is not stored. A weight is shown only when it was saved on a confirmed event.");
		int missingWeights = (int) events.stream().filter(event -> event.weight() == null).count();
		if (missingWeights > 0) {
			notes.add(missingWeights + " confirmed events have no weight saved.");
		}
		int missingQuotes = (int) events.stream().filter(event -> event.quote() == null).count();
		if (missingQuotes > 0) {
			notes.add(missingQuotes + " confirmed events have no syllabus quote saved.");
		}
		if (events.isEmpty()) {
			notes.add("No confirmed events are on the calendar.");
		} else if (nextExam == null) {
			notes.add("No upcoming exam is on the calendar.");
		}
		return List.copyOf(notes);
	}

	private static Report workload(LocalDate today, List<CourseInput> courses, List<EventInput> events) {
		List<WorkloadCalculator.CourseInput> courseInputs = courses.stream()
				.map(course -> new WorkloadCalculator.CourseInput(course.id(), courseName(course), course.termStart(), course.termEnd()))
				.toList();
		List<WorkloadCalculator.EventInput> eventInputs = events.stream()
				.map(event -> new WorkloadCalculator.EventInput(
						event.id(),
						event.courseId(),
						singleLine(event.title(), "Untitled event"),
						typeOf(event),
						event.date(),
						event.start(),
						event.end(),
						event.weight()))
				.toList();
		return WorkloadCalculator.calculate(today, courseInputs, eventInputs);
	}

	private static BusyWeekView busy(BusyWeek week) {
		return new BusyWeekView(week.start(), week.end(), week.events(), week.reasons());
	}

	private static OverlapView overlap(Overlap overlap) {
		return new OverlapView(overlap.date(), overlap.titles());
	}

	private static int count(List<EventInput> events, String type) {
		return (int) events.stream().filter(event -> type.equals(typeOf(event))).count();
	}

	private static String typeOf(EventInput event) {
		if (event.type() == null || event.type().isBlank()) {
			return "OTHER";
		}
		String type = event.type().trim().toUpperCase(Locale.ROOT);
		return TYPES.contains(type) ? type : "OTHER";
	}

	private static List<CourseInput> cleanCourses(List<CourseInput> courses) {
		if (courses == null) {
			return List.of();
		}
		return courses.stream()
				.filter(course -> course != null && course.id() != null)
				.sorted(Comparator.comparing((CourseInput course) -> courseName(course), String.CASE_INSENSITIVE_ORDER)
						.thenComparing(CourseInput::id))
				.toList();
	}

	private static List<EventInput> cleanEvents(List<EventInput> events) {
		if (events == null) {
			return List.of();
		}
		return events.stream()
				.filter(event -> event != null && event.courseId() != null && event.date() != null)
				.toList();
	}

	private static Comparator<EventInput> eventOrder(Map<UUID, String> names) {
		return Comparator.comparing(EventInput::date)
				.thenComparing(event -> names.getOrDefault(event.courseId(), ""))
				.thenComparing(event -> singleLine(event.title(), ""))
				.thenComparing(event -> event.id() == null ? "" : event.id().toString());
	}

	private static String courseName(CourseInput course) {
		return singleLine(course.name(), "Untitled course");
	}

	private static String singleLine(String value, String fallback) {
		if (value == null) {
			return fallback;
		}
		String text = value.trim().replaceAll("\\s+", " ");
		return text.isEmpty() ? fallback : text;
	}

	static String column(int index) {
		StringBuilder name = new StringBuilder();
		int n = index + 1;
		while (n > 0) {
			n--;
			name.insert(0, (char) ('A' + n % 26));
			n /= 26;
		}
		return name.toString();
	}
}
