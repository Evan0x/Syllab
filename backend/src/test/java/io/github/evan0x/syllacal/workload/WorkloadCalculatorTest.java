package io.github.evan0x.syllacal.workload;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WorkloadCalculatorTest {

	private static final LocalDate TODAY = LocalDate.parse("2026-11-10");
	private static final UUID BIO = UUID.fromString("00000000-0000-0000-0000-000000000001");
	private static final UUID CS = UUID.fromString("00000000-0000-0000-0000-000000000002");
	private static final UUID PAST = UUID.fromString("00000000-0000-0000-0000-000000000003");
	private static final UUID FUTURE = UUID.fromString("00000000-0000-0000-0000-000000000004");

	@Test
	void countsAssignmentsExamsAndTheRemainingWeekWithoutTreatingMissingWeightAsZero() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(
				course(BIO, "BIO 201", "2026-08-25", "2026-12-12"),
				course(CS, "CS 310", null, null)), List.of(
				event(BIO, "Lab", "ASSIGNMENT", "2026-11-12", null, null, null),
				event(BIO, "Poster", "PROJECT", "2026-11-18", null, null, new BigDecimal("15")),
				event(BIO, "Quiz", "QUIZ", "2026-11-11", null, null, null),
				event(CS, "Midterm", "EXAM", "2026-11-10", "14:00", "15:30", new BigDecimal("25")),
				event(CS, "Old set", "ASSIGNMENT", "2026-11-03", null, null, null)));

		assertThat(report.activeCourses()).isEqualTo(2);
		assertThat(report.upcomingAssignments()).isEqualTo(2);
		assertThat(report.upcomingExams()).isEqualTo(1);
		assertThat(report.dueThisWeek()).isEqualTo(3);
		assertThat(report.dueNextWeek()).isEqualTo(1);
		assertThat(report.busiestWeek().start()).isEqualTo(LocalDate.parse("2026-11-08"));
		assertThat(report.busiestWeek().events()).isEqualTo(3);
		WorkloadCalculator.CourseLoad biology = report.courses().stream()
				.filter(course -> course.id().equals(BIO))
				.findFirst()
				.orElseThrow();
		assertThat(biology.weightsMissing()).isEqualTo(2);
		assertThat(biology.weightsPresent()).containsExactly(new BigDecimal("15"));
		assertThat(biology.eventShare()).isEqualTo(75);
		assertThat(report.facts()).anyMatch(fact -> fact.contains("Next week has") && fact.contains("This week has 3 left"));
	}

	@Test
	void activeCoursesFollowTheTermOrAnUpcomingEvent() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(
				course(BIO, "BIO 201", "2026-08-25", "2026-12-12"),
				course(PAST, "HIST 101", "2026-01-10", "2026-05-01"),
				course(FUTURE, "ART 220", "2027-01-10", "2027-05-01"),
				course(CS, "CS 310", null, null)), List.of(
				event(CS, "Midterm", "EXAM", "2026-11-12", null, null, null),
				event(PAST, "Final", "EXAM", "2026-04-20", null, null, null)));

		assertThat(report.activeCourses()).isEqualTo(2);
		assertThat(report.courses()).extracting(WorkloadCalculator.CourseLoad::name)
				.containsExactly("CS 310", "BIO 201");
	}

	@Test
	void theEarlierWeekWinsATieForBusiest() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(course(CS, "CS 310", null, null)), List.of(
				event(CS, "One", "ASSIGNMENT", "2026-11-10", null, null, null),
				event(CS, "Two", "ASSIGNMENT", "2026-11-11", null, null, null),
				event(CS, "Three", "ASSIGNMENT", "2026-11-17", null, null, null),
				event(CS, "Four", "ASSIGNMENT", "2026-11-18", null, null, null)));

		assertThat(report.busiestWeek().start()).isEqualTo(LocalDate.parse("2026-11-08"));
		assertThat(report.facts().getFirst()).isEqualTo("Your busiest week is November 8–14, with 2 deadlines.");
	}

	@Test
	void aWeekIsUnusuallyHighOnlyWhenItClearsTheMedianAndTheFloor() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(course(CS, "CS 310", null, null)), List.of(
				event(CS, "A", "ASSIGNMENT", "2026-11-10", null, null, null),
				event(CS, "B", "ASSIGNMENT", "2026-11-17", null, null, null),
				event(CS, "C1", "ASSIGNMENT", "2026-11-24", null, null, null),
				event(CS, "C2", "ASSIGNMENT", "2026-11-24", null, null, null),
				event(CS, "C3", "EXAM", "2026-11-26", null, null, null),
				event(CS, "C4", "EXAM", "2026-11-27", null, null, null)));

		assertThat(report.busyWeeks()).anySatisfy(week -> {
			assertThat(week.start()).isEqualTo(LocalDate.parse("2026-11-22"));
			assertThat(week.reasons()).contains("Unusually high event count", "Multiple exams", "Multiple deadlines on one day");
		});
	}

	@Test
	void timedOverlapIsSeparateFromASharedDayWithoutTimes() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(course(CS, "CS 310", null, null)), List.of(
				event(CS, "Midterm", "EXAM", "2026-11-12", "14:00", "15:30", null),
				event(CS, "Review", "ADMIN", "2026-11-12", "15:00", "16:00", null),
				event(CS, "Next class", "ADMIN", "2026-11-12", "16:00", "17:00", null),
				event(CS, "Reading", "ASSIGNMENT", "2026-11-13", null, null, null),
				event(CS, "Lab", "ASSIGNMENT", "2026-11-13", null, null, null)));

		assertThat(report.overlaps()).singleElement().satisfies(overlap -> {
			assertThat(overlap.date()).isEqualTo(LocalDate.parse("2026-11-12"));
			assertThat(overlap.titles()).containsExactly("Midterm", "Review");
		});
		assertThat(report.crowdedDays()).hasSize(2);
	}

	@Test
	void examsInsideFiveDaysAreCountedAndALaterExamStaysOutside() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(course(CS, "CS 310", null, null)), List.of(
				event(CS, "One", "EXAM", "2026-11-10", null, null, null),
				event(CS, "Two", "EXAM", "2026-11-12", null, null, null),
				event(CS, "Three", "EXAM", "2026-11-14", null, null, null),
				event(CS, "Later", "EXAM", "2026-12-01", null, null, null)));

		assertThat(report.facts()).contains("You have three exams within five days, from November 10–14.");
	}

	@Test
	void nextWeekCanBeDescribedAsTwiceTheCurrentWeek() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(course(CS, "CS 310", null, null)), List.of(
				event(CS, "Now", "ASSIGNMENT", "2026-11-10", null, null, null),
				event(CS, "Later one", "ASSIGNMENT", "2026-11-16", null, null, null),
				event(CS, "Later two", "QUIZ", "2026-11-17", null, null, null)));

		assertThat(report.facts()).contains("Next week has twice as many deadlines as your current week.");
		assertThat(report.currentWeek()).hasSize(7);
		assertThat(report.currentWeek().get(2).date()).isEqualTo(TODAY);
		assertThat(report.currentWeek().get(2).total()).isEqualTo(1);
		assertThat(report.nextFourWeeks()).hasSize(4);
		assertThat(report.nextFourWeeks().getFirst().start()).isEqualTo(LocalDate.parse("2026-11-15"));
	}

	@Test
	void theLargestCourseShareUsesUpcomingEvents() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(
				course(CS, "CS 310", null, null),
				course(BIO, "BIO 201", null, null)), List.of(
				event(CS, "One", "ASSIGNMENT", "2026-11-10", null, null, null),
				event(CS, "Two", "ASSIGNMENT", "2026-11-11", null, null, null),
				event(BIO, "Quiz", "QUIZ", "2026-11-12", null, null, null)));

		assertThat(report.facts()).contains("CS 310 accounts for the largest share of your upcoming deadlines (2 of 3).");
		assertThat(report.courses().getFirst().eventShare()).isEqualTo(67);
	}

	@Test
	void anEmptyCalendarHasNoInventedMetrics() {
		WorkloadCalculator.Report report = WorkloadCalculator.calculate(TODAY, List.of(), List.of());

		assertThat(report.activeCourses()).isZero();
		assertThat(report.upcomingAssignments()).isZero();
		assertThat(report.upcomingExams()).isZero();
		assertThat(report.busiestWeek()).isNull();
		assertThat(report.semesterStart()).isNull();
		assertThat(report.facts()).containsExactly("No upcoming deadlines are on your calendar.");
	}

	@Test
	void suggestionsThatInventADurationAreDropped() {
		String sheet = "Upcoming assignments: 2\nCourse CS 310: upcoming 2\n";
		assertThat(WorkloadSuggestions.keep(List.of(
				"Start CS 310 before the two deadlines pile up.",
				"This assignment will take 8 hours.",
				"  Block time for CS 310.  "), sheet))
				.containsExactly("Start CS 310 before the two deadlines pile up.", "Block time for CS 310.");
	}

	private static WorkloadCalculator.CourseInput course(UUID id, String name, String start, String end) {
		return new WorkloadCalculator.CourseInput(id, name, start == null ? null : LocalDate.parse(start), end == null ? null : LocalDate.parse(end));
	}

	private static WorkloadCalculator.EventInput event(
			UUID courseId, String title, String type, String date, String start, String end, BigDecimal weight) {
		return new WorkloadCalculator.EventInput(
				UUID.randomUUID(),
				courseId,
				title,
				type,
				LocalDate.parse(date),
				start == null ? null : LocalTime.parse(start),
				end == null ? null : LocalTime.parse(end),
				weight);
	}
}
