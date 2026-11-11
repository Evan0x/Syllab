package io.github.evan0x.syllacal.workload;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

public final class WorkloadCalculator {

	private static final int MAX_SEMESTER_WEEKS = 52;
	private static final DateTimeFormatter MONTH_DAY = DateTimeFormatter.ofPattern("MMMM d", Locale.US);
	private static final DateTimeFormatter MONTH_DAY_YEAR = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US);

	private WorkloadCalculator() {
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
			BigDecimal weight) {
	}

	public record Report(
			LocalDate today,
			LocalDate semesterStart,
			LocalDate semesterEnd,
			boolean semesterTruncated,
			int activeCourses,
			int upcomingAssignments,
			int upcomingExams,
			int dueThisWeek,
			int dueNextWeek,
			WeekRef busiestWeek,
			List<String> facts,
			List<BusyWeek> busyWeeks,
			List<CrowdedDay> crowdedDays,
			List<Overlap> overlaps,
			List<CourseLoad> courses,
			List<DayLoad> currentWeek,
			List<WeekLoad> nextFourWeeks,
			List<WeekLoad> semesterWeeks) {
	}

	public record WeekRef(LocalDate start, LocalDate end, int events) {
	}

	public record BusyWeek(LocalDate start, LocalDate end, int events, List<String> reasons) {
	}

	public record CrowdedDay(LocalDate date, int events) {
	}

	public record Overlap(LocalDate date, List<String> titles) {
	}

	public record CourseLoad(
			UUID id,
			String name,
			LocalDate termStart,
			LocalDate termEnd,
			int upcomingAssignments,
			int upcomingExams,
			int upcomingEvents,
			Integer eventShare,
			int weightsMissing,
			List<BigDecimal> weightsPresent,
			List<Deadline> deadlines) {
	}

	public record Deadline(String title, String type, LocalDate date, BigDecimal weightPercent) {
	}

	public record DayLoad(LocalDate date, int assignments, int exams, int other, int total) {
	}

	public record WeekLoad(
			LocalDate start,
			LocalDate end,
			int assignments,
			int exams,
			int other,
			int total,
			List<CourseCount> courses) {
	}

	public record CourseCount(String name, int events) {
	}

	public static Report calculate(LocalDate today, List<CourseInput> courses, List<EventInput> events) {
		List<CourseInput> courseList = courses == null ? List.of() : List.copyOf(courses);
		List<EventInput> eventList = events == null ? List.of() : events.stream()
				.filter(event -> event != null && event.date() != null && event.courseId() != null)
				.toList();
		Map<UUID, CourseInput> byId = new LinkedHashMap<>();
		for (CourseInput course : courseList) {
			if (course != null && course.id() != null) {
				byId.putIfAbsent(course.id(), course);
			}
		}

		LocalDate thisStart = weekStart(today);
		LocalDate thisEnd = thisStart.plusDays(6);
		LocalDate nextStart = thisStart.plusWeeks(1);
		LocalDate nextEnd = nextStart.plusDays(6);

		List<EventInput> upcoming = eventList.stream()
				.filter(event -> !event.date().isBefore(today))
				.toList();
		int upcomingAssignments = (int) upcoming.stream().filter(WorkloadCalculator::isAssignment).count();
		int upcomingExams = (int) upcoming.stream().filter(WorkloadCalculator::isExam).count();
		int dueThisWeek = (int) upcoming.stream()
				.filter(event -> !event.date().isAfter(thisEnd))
				.count();
		int dueNextWeek = (int) eventList.stream()
				.filter(event -> !event.date().isBefore(nextStart) && !event.date().isAfter(nextEnd))
				.count();

		Map<LocalDate, List<EventInput>> upcomingByWeek = group(upcoming, thisStart);
		WeekRef busiest = busiestWeek(upcomingByWeek);
		List<CrowdedDay> crowdedDays = crowdedDays(upcoming);
		List<Overlap> overlaps = overlaps(upcoming);
		List<BusyWeek> busyWeeks = busyWeeks(upcomingByWeek, crowdedDays, overlaps);
		int activeCourses = activeCourses(byId, eventList, today);
		List<CourseLoad> courseLoads = courseLoads(byId, eventList, today, upcoming.size());
		Range semester = semesterRange(byId, eventList);
		List<WeekLoad> semesterWeeks = List.of();
		boolean truncated = false;
		if (semester != null) {
			List<LocalDate> weeks = weeksBetween(semester.start(), semester.end());
			truncated = weeks.size() > MAX_SEMESTER_WEEKS;
			if (truncated) {
				weeks = trimWeeks(weeks, today);
			}
			semesterWeeks = weeks.stream().map(start -> weekLoad(start, eventList, byId)).toList();
		}

		List<DayLoad> currentWeek = new ArrayList<>();
		for (int day = 0; day < 7; day++) {
			LocalDate date = thisStart.plusDays(day);
			currentWeek.add(dayLoad(date, eventList));
		}
		List<WeekLoad> nextFour = new ArrayList<>();
		for (int week = 1; week <= 4; week++) {
			nextFour.add(weekLoad(thisStart.plusWeeks(week), eventList, byId));
		}

		List<String> facts = facts(
				busiest, upcomingExams, upcoming, courseLoads, dueThisWeek, dueNextWeek, crowdedDays);
		return new Report(
				today,
				semester == null ? null : semester.start(),
				semester == null ? null : semester.end(),
				truncated,
				activeCourses,
				upcomingAssignments,
				upcomingExams,
				dueThisWeek,
				dueNextWeek,
				busiest,
				List.copyOf(facts),
				busyWeeks,
				crowdedDays,
				overlaps,
				courseLoads,
				List.copyOf(currentWeek),
				List.copyOf(nextFour),
				semesterWeeks);
	}

	public static String insightSheet(Report report) {
		StringBuilder sheet = new StringBuilder();
		sheet.append("Today: ").append(report.today()).append('\n');
		sheet.append("Active courses: ").append(report.activeCourses()).append('\n');
		sheet.append("Upcoming assignments: ").append(report.upcomingAssignments()).append('\n');
		sheet.append("Upcoming exams: ").append(report.upcomingExams()).append('\n');
		sheet.append("Deadlines left this week: ").append(report.dueThisWeek()).append('\n');
		sheet.append("Deadlines next week: ").append(report.dueNextWeek()).append('\n');
		if (report.busiestWeek() != null) {
			sheet.append("Busiest week: ")
					.append(report.busiestWeek().start())
					.append(" to ")
					.append(report.busiestWeek().end())
					.append(", events ")
					.append(report.busiestWeek().events())
					.append('\n');
		}
		for (CourseLoad course : report.courses()) {
			sheet.append("Course ")
					.append(course.name())
					.append(": upcoming ")
					.append(course.upcomingEvents())
					.append(", assignments ")
					.append(course.upcomingAssignments())
					.append(", exams ")
					.append(course.upcomingExams())
					.append(", weights present");
			if (course.weightsPresent().isEmpty()) {
				sheet.append(" none");
			} else {
				for (BigDecimal weight : course.weightsPresent()) {
					sheet.append(' ').append(weight.stripTrailingZeros().toPlainString());
				}
			}
			sheet.append(", weights missing ").append(course.weightsMissing()).append('\n');
		}
		for (BusyWeek week : report.busyWeeks()) {
			sheet.append("Busy week ")
					.append(week.start())
					.append(" to ")
					.append(week.end())
					.append(", events ")
					.append(week.events())
					.append(", reasons");
			for (String reason : week.reasons()) {
				sheet.append(' ').append(reason);
			}
			sheet.append('\n');
		}
		for (CrowdedDay day : report.crowdedDays()) {
			sheet.append("Crowded day ").append(day.date()).append(", events ").append(day.events()).append('\n');
		}
		sheet.append("Overlapping timed commitments: ").append(report.overlaps().size()).append('\n');
		for (String fact : report.facts()) {
			sheet.append("Fact: ").append(fact).append('\n');
		}
		return sheet.toString();
	}

	private static List<String> facts(
			WeekRef busiest,
			int upcomingExams,
			List<EventInput> upcoming,
			List<CourseLoad> courses,
			int dueThisWeek,
			int dueNextWeek,
			List<CrowdedDay> crowdedDays) {
		List<String> facts = new ArrayList<>();
		if (busiest != null) {
			String deadline = busiest.events() == 1 ? "deadline" : "deadlines";
			facts.add("Your busiest week is " + formatSpan(busiest.start(), busiest.end())
					+ ", with " + busiest.events() + " " + deadline + ".");
		}
		ExamWindow exams = examWindow(upcoming);
		if (exams != null && exams.count() >= 2) {
			facts.add("You have " + countWord(exams.count()) + " exams within five days, from "
					+ formatSpan(exams.start(), exams.end()) + ".");
		} else if (upcomingExams == 0 && !upcoming.isEmpty()) {
			facts.add("You have no upcoming exams.");
		}
		largestShare(courses).ifPresent(facts::add);
		String comparison = compareWeeks(dueThisWeek, dueNextWeek);
		if (comparison != null) {
			facts.add(comparison);
		}
		crowdedDays.stream()
				.max(Comparator.comparingInt(CrowdedDay::events).thenComparing(CrowdedDay::date))
				.filter(day -> day.events() >= 2)
				.ifPresent(day -> facts.add(formatDay(day.date()) + " has " + day.events() + " deadlines."));
		if (facts.isEmpty() && upcoming.isEmpty()) {
			facts.add("No upcoming deadlines are on your calendar.");
		}
		return facts;
	}

	private static java.util.Optional<String> largestShare(List<CourseLoad> courses) {
		int most = courses.stream().mapToInt(CourseLoad::upcomingEvents).max().orElse(0);
		if (most == 0) {
			return java.util.Optional.empty();
		}
		List<String> names = courses.stream()
				.filter(course -> course.upcomingEvents() == most)
				.map(CourseLoad::name)
				.sorted()
				.toList();
		int total = courses.stream().mapToInt(CourseLoad::upcomingEvents).sum();
		String joined = joinNames(names);
		String verb = names.size() == 1 ? "accounts" : "account";
		return java.util.Optional.of(joined + " " + verb + " for the largest share of your upcoming deadlines ("
				+ most + " of " + total + ").");
	}

	private static String compareWeeks(int dueThisWeek, int dueNextWeek) {
		if (dueThisWeek == 0 && dueNextWeek == 0) {
			return null;
		}
		if (dueThisWeek == 0) {
			return "Next week has " + dueNextWeek + " " + deadlines(dueNextWeek) + ". This week has none left.";
		}
		if (dueNextWeek == 0) {
			return "This week has " + dueThisWeek + " " + deadlines(dueThisWeek) + " left. Next week has none.";
		}
		if (dueNextWeek == dueThisWeek * 2) {
			return "Next week has twice as many deadlines as your current week.";
		}
		if (dueThisWeek == dueNextWeek * 2) {
			return "This week has twice as many deadlines left as next week.";
		}
		if (dueNextWeek == dueThisWeek) {
			return "Next week has the same number of deadlines as this week (" + dueThisWeek + ").";
		}
		return "Next week has " + dueNextWeek + " deadlines. This week has " + dueThisWeek + " left.";
	}

	private static List<BusyWeek> busyWeeks(
			Map<LocalDate, List<EventInput>> upcomingByWeek,
			List<CrowdedDay> crowdedDays,
			List<Overlap> overlaps) {
		List<Integer> counts = upcomingByWeek.values().stream().map(List::size).sorted().toList();
		double median = median(counts);
		List<BusyWeek> busy = new ArrayList<>();
		for (Map.Entry<LocalDate, List<EventInput>> entry : upcomingByWeek.entrySet()) {
			List<EventInput> weekEvents = entry.getValue();
			int count = weekEvents.size();
			LocalDate start = entry.getKey();
			LocalDate end = start.plusDays(6);
			List<String> reasons = new ArrayList<>();
			long exams = weekEvents.stream().filter(WorkloadCalculator::isExam).count();
			if (counts.size() >= 3 && count >= 4 && count >= median * 1.5) {
				reasons.add("Unusually high event count");
			}
			if (exams >= 2) {
				reasons.add("Multiple exams");
			}
			if (crowdedDays.stream().anyMatch(day -> !day.date().isBefore(start) && !day.date().isAfter(end))) {
				reasons.add("Multiple deadlines on one day");
			}
			if (overlaps.stream().anyMatch(overlap -> !overlap.date().isBefore(start) && !overlap.date().isAfter(end))) {
				reasons.add("Overlapping commitments");
			}
			if (!reasons.isEmpty()) {
				busy.add(new BusyWeek(start, end, count, List.copyOf(reasons)));
			}
		}
		busy.sort(Comparator.comparing(BusyWeek::start));
		return List.copyOf(busy);
	}

	private static WeekRef busiestWeek(Map<LocalDate, List<EventInput>> upcomingByWeek) {
		WeekRef busiest = null;
		for (Map.Entry<LocalDate, List<EventInput>> entry : upcomingByWeek.entrySet()) {
			int count = entry.getValue().size();
			if (count == 0) {
				continue;
			}
			if (busiest == null || count > busiest.events() || (count == busiest.events() && entry.getKey().isBefore(busiest.start()))) {
				busiest = new WeekRef(entry.getKey(), entry.getKey().plusDays(6), count);
			}
		}
		return busiest;
	}

	private static List<CourseLoad> courseLoads(
			Map<UUID, CourseInput> courses,
			List<EventInput> events,
			LocalDate today,
			int upcomingTotal) {
		List<CourseLoad> loads = new ArrayList<>();
		for (CourseInput course : courses.values()) {
			List<EventInput> own = events.stream().filter(event -> course.id().equals(event.courseId())).toList();
			List<EventInput> upcoming = own.stream().filter(event -> !event.date().isBefore(today)).toList();
			boolean active = active(course, own, today);
			if (!active && upcoming.isEmpty()) {
				continue;
			}
			int assignments = (int) upcoming.stream().filter(WorkloadCalculator::isAssignment).count();
			int exams = (int) upcoming.stream().filter(WorkloadCalculator::isExam).count();
			List<BigDecimal> weights = upcoming.stream()
					.map(EventInput::weight)
					.filter(weight -> weight != null)
					.toList();
			int missing = (int) upcoming.stream().filter(event -> event.weight() == null).count();
			Integer share = upcomingTotal == 0
					? null
					: BigDecimal.valueOf(upcoming.size() * 100.0 / upcomingTotal).setScale(0, RoundingMode.HALF_UP).intValue();
			List<Deadline> deadlines = upcoming.stream()
					.sorted(Comparator.comparing(EventInput::date)
							.thenComparing(event -> event.start() == null ? LocalTime.MAX : event.start())
							.thenComparing(event -> event.title() == null ? "" : event.title()))
					.map(event -> new Deadline(event.title(), normalizeType(event.type()), event.date(), event.weight()))
					.toList();
			loads.add(new CourseLoad(
					course.id(),
					course.name() == null || course.name().isBlank() ? "Course" : course.name().trim(),
					course.termStart(),
					course.termEnd(),
					assignments,
					exams,
					upcoming.size(),
					share,
					missing,
					weights,
					deadlines));
		}
		loads.sort(Comparator.comparingInt(CourseLoad::upcomingEvents).reversed().thenComparing(CourseLoad::name));
		return List.copyOf(loads);
	}

	private static int activeCourses(Map<UUID, CourseInput> courses, List<EventInput> events, LocalDate today) {
		int active = 0;
		for (CourseInput course : courses.values()) {
			List<EventInput> own = events.stream().filter(event -> course.id().equals(event.courseId())).toList();
			if (active(course, own, today)) {
				active++;
			}
		}
		return active;
	}

	private static boolean active(CourseInput course, List<EventInput> own, LocalDate today) {
		if (course.termStart() != null && course.termEnd() != null && !course.termEnd().isBefore(course.termStart())) {
			return !today.isBefore(course.termStart()) && !today.isAfter(course.termEnd());
		}
		return own.stream().anyMatch(event -> !event.date().isBefore(today));
	}

	private static Range semesterRange(Map<UUID, CourseInput> courses, List<EventInput> events) {
		LocalDate start = null;
		LocalDate end = null;
		for (CourseInput course : courses.values()) {
			List<EventInput> own = events.stream().filter(event -> course.id().equals(event.courseId())).toList();
			LocalDate courseStart = course.termStart();
			LocalDate courseEnd = course.termEnd();
			if (courseStart == null || courseEnd == null) {
				for (EventInput event : own) {
					courseStart = earlier(courseStart, event.date());
					courseEnd = later(courseEnd, event.date());
				}
			}
			start = earlier(start, courseStart);
			end = later(end, courseEnd);
		}
		for (EventInput event : events) {
			start = earlier(start, event.date());
			end = later(end, event.date());
		}
		if (start == null || end == null || end.isBefore(start)) {
			return null;
		}
		return new Range(start, end);
	}

	private static List<CrowdedDay> crowdedDays(List<EventInput> upcoming) {
		Map<LocalDate, Integer> counts = new LinkedHashMap<>();
		for (EventInput event : upcoming) {
			counts.merge(event.date(), 1, Integer::sum);
		}
		return counts.entrySet().stream()
				.filter(entry -> entry.getValue() >= 2)
				.sorted(Map.Entry.comparingByKey())
				.map(entry -> new CrowdedDay(entry.getKey(), entry.getValue()))
				.toList();
	}

	private static List<Overlap> overlaps(List<EventInput> upcoming) {
		Map<LocalDate, List<EventInput>> byDay = new LinkedHashMap<>();
		for (EventInput event : upcoming) {
			if (event.start() != null) {
				byDay.computeIfAbsent(event.date(), ignored -> new ArrayList<>()).add(event);
			}
		}
		List<Overlap> overlaps = new ArrayList<>();
		for (Map.Entry<LocalDate, List<EventInput>> entry : byDay.entrySet()) {
			List<EventInput> day = entry.getValue();
			List<String> titles = new ArrayList<>();
			for (int left = 0; left < day.size(); left++) {
				for (int right = left + 1; right < day.size(); right++) {
					if (overlaps(day.get(left), day.get(right))) {
						addTitle(titles, day.get(left));
						addTitle(titles, day.get(right));
					}
				}
			}
			if (!titles.isEmpty()) {
				overlaps.add(new Overlap(entry.getKey(), List.copyOf(titles)));
			}
		}
		return List.copyOf(overlaps);
	}

	private static boolean overlaps(EventInput left, EventInput right) {
		LocalTime leftEnd = left.end() == null ? left.start() : left.end();
		LocalTime rightEnd = right.end() == null ? right.start() : right.end();
		boolean ranges = left.start().isBefore(rightEnd) && right.start().isBefore(leftEnd);
		return ranges || left.start().equals(right.start());
	}

	private static void addTitle(List<String> titles, EventInput event) {
		String title = event.title() == null || event.title().isBlank() ? "Untitled event" : event.title().trim();
		if (!titles.contains(title)) {
			titles.add(title);
		}
	}

	private static Map<LocalDate, List<EventInput>> group(List<EventInput> events, LocalDate earliestWeek) {
		Map<LocalDate, List<EventInput>> grouped = new LinkedHashMap<>();
		events.stream()
				.map(event -> weekStart(event.date()))
				.filter(start -> !start.isBefore(earliestWeek))
				.distinct()
				.sorted()
				.forEach(start -> grouped.put(start, new ArrayList<>()));
		for (EventInput event : events) {
			LocalDate start = weekStart(event.date());
			if (!start.isBefore(earliestWeek)) {
				grouped.computeIfAbsent(start, ignored -> new ArrayList<>()).add(event);
			}
		}
		return grouped;
	}

	private static WeekLoad weekLoad(LocalDate start, List<EventInput> events, Map<UUID, CourseInput> courses) {
		LocalDate end = start.plusDays(6);
		List<EventInput> inside = events.stream()
				.filter(event -> !event.date().isBefore(start) && !event.date().isAfter(end))
				.toList();
		return new WeekLoad(start, end, count(inside, WorkloadCalculator::isAssignment), count(inside, WorkloadCalculator::isExam),
				count(inside, event -> !isAssignment(event) && !isExam(event)), inside.size(), courseCounts(inside, courses));
	}

	private static DayLoad dayLoad(LocalDate date, List<EventInput> events) {
		List<EventInput> inside = events.stream().filter(event -> event.date().equals(date)).toList();
		return new DayLoad(date, count(inside, WorkloadCalculator::isAssignment), count(inside, WorkloadCalculator::isExam),
				count(inside, event -> !isAssignment(event) && !isExam(event)), inside.size());
	}

	private static List<CourseCount> courseCounts(List<EventInput> events, Map<UUID, CourseInput> courses) {
		Map<String, Integer> counts = new LinkedHashMap<>();
		for (EventInput event : events) {
			CourseInput course = courses.get(event.courseId());
			String name = course == null || course.name() == null || course.name().isBlank() ? "Course" : course.name().trim();
			counts.merge(name, 1, Integer::sum);
		}
		return counts.entrySet().stream()
				.sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
				.map(entry -> new CourseCount(entry.getKey(), entry.getValue()))
				.toList();
	}

	private static int count(List<EventInput> events, java.util.function.Predicate<EventInput> predicate) {
		return (int) events.stream().filter(predicate).count();
	}

	private static ExamWindow examWindow(List<EventInput> upcoming) {
		List<LocalDate> dates = upcoming.stream()
				.filter(WorkloadCalculator::isExam)
				.map(EventInput::date)
				.sorted()
				.toList();
		ExamWindow best = null;
		for (int start = 0; start < dates.size(); start++) {
			int end = start;
			while (end + 1 < dates.size() && ChronoUnit.DAYS.between(dates.get(start), dates.get(end + 1)) <= 4) {
				end++;
			}
			int count = end - start + 1;
			if (count >= 2 && (best == null || count > best.count())) {
				best = new ExamWindow(dates.get(start), dates.get(end), count);
			}
		}
		return best;
	}

	private static List<LocalDate> weeksBetween(LocalDate start, LocalDate end) {
		List<LocalDate> weeks = new ArrayList<>();
		LocalDate cursor = weekStart(start);
		LocalDate last = weekStart(end);
		while (!cursor.isAfter(last)) {
			weeks.add(cursor);
			cursor = cursor.plusWeeks(1);
		}
		return weeks;
	}

	private static List<LocalDate> trimWeeks(List<LocalDate> weeks, LocalDate today) {
		LocalDate current = weekStart(today);
		int index = 0;
		for (int i = 0; i < weeks.size(); i++) {
			if (!weeks.get(i).isAfter(current)) {
				index = i;
			}
		}
		int from = Math.max(0, Math.min(index, weeks.size() - MAX_SEMESTER_WEEKS));
		return weeks.subList(from, Math.min(weeks.size(), from + MAX_SEMESTER_WEEKS));
	}

	static LocalDate weekStart(LocalDate date) {
		return date.minusDays(date.getDayOfWeek().getValue() % 7);
	}

	private static boolean isAssignment(EventInput event) {
		String type = normalizeType(event.type());
		return "ASSIGNMENT".equals(type) || "PROJECT".equals(type);
	}

	private static boolean isExam(EventInput event) {
		return "EXAM".equals(normalizeType(event.type()));
	}

	private static String normalizeType(String type) {
		return type == null ? "OTHER" : type.trim().toUpperCase(Locale.ROOT);
	}

	private static double median(List<Integer> sorted) {
		if (sorted.isEmpty()) {
			return 0;
		}
		int middle = sorted.size() / 2;
		if (sorted.size() % 2 == 1) {
			return sorted.get(middle);
		}
		return (sorted.get(middle - 1) + sorted.get(middle)) / 2.0;
	}

	private static LocalDate earlier(LocalDate current, LocalDate candidate) {
		if (candidate == null) {
			return current;
		}
		return current == null || candidate.isBefore(current) ? candidate : current;
	}

	private static LocalDate later(LocalDate current, LocalDate candidate) {
		if (candidate == null) {
			return current;
		}
		return current == null || candidate.isAfter(current) ? candidate : current;
	}

	private static String formatSpan(LocalDate start, LocalDate end) {
		if (start.equals(end)) {
			return formatDay(start);
		}
		if (start.getYear() != end.getYear()) {
			return start.format(MONTH_DAY_YEAR) + "–" + end.format(MONTH_DAY_YEAR);
		}
		if (start.getMonth() != end.getMonth()) {
			return start.format(MONTH_DAY) + "–" + end.format(MONTH_DAY);
		}
		return start.format(MONTH_DAY) + "–" + end.getDayOfMonth();
	}

	private static String formatDay(LocalDate date) {
		return date.format(MONTH_DAY_YEAR);
	}

	private static String deadlines(int count) {
		return count == 1 ? "deadline" : "deadlines";
	}

	private static String countWord(int count) {
		return switch (count) {
			case 2 -> "two";
			case 3 -> "three";
			case 4 -> "four";
			case 5 -> "five";
			case 6 -> "six";
			case 7 -> "seven";
			case 8 -> "eight";
			case 9 -> "nine";
			default -> Integer.toString(count);
		};
	}

	private static String joinNames(List<String> names) {
		if (names.size() == 1) {
			return names.getFirst();
		}
		if (names.size() == 2) {
			return names.get(0) + " and " + names.get(1);
		}
		return String.join(", ", names.subList(0, names.size() - 1)) + ", and " + names.getLast();
	}

	private record Range(LocalDate start, LocalDate end) {
	}

	private record ExamWindow(LocalDate start, LocalDate end, int count) {
	}
}
