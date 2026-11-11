package io.github.evan0x.syllacal.advisor;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CourseAdvisorTest {

	private static final LocalDate TODAY = LocalDate.of(2026, 11, 10);

	@Test
	void countsSeparateTypesAndLeavesAMissingWeightUnspecified() {
		UUID courseId = UUID.randomUUID();
		UUID examId = UUID.randomUUID();
		CourseAdvisor.Analysis analysis = CourseAdvisor.analyze(TODAY, List.of(course(courseId, "CS 310")), List.of(
				event(examId, courseId, "Midterm", "EXAM", "2026-11-14", new BigDecimal("25.00"), "Midterm covers chapters 1 through 6."),
				event(UUID.randomUUID(), courseId, "Problem set", "ASSIGNMENT", "2026-11-12", null, null),
				event(UUID.randomUUID(), courseId, "Draft", "PROJECT", "2026-11-18", new BigDecimal("15"), null)));

		CourseAdvisor.CourseBrief course = analysis.courses().getFirst();
		assertThat(course.assignments()).isEqualTo(1);
		assertThat(course.projects()).isEqualTo(1);
		assertThat(course.exams()).isEqualTo(1);
		assertThat(course.upcoming()).isEqualTo(3);
		assertThat(course.weightsMissing()).isEqualTo(1);
		assertThat(course.weights()).extracting(CourseAdvisor.WeightNote::weight)
				.containsExactly(new BigDecimal("25"), new BigDecimal("15"));
		assertThat(course.deadlines())
				.filteredOn(deadline -> "Midterm".equals(deadline.title()))
				.extracting(CourseAdvisor.DeadlineNote::quote)
				.containsExactly("Midterm covers chapters 1 through 6.");
		assertThat(analysis.nextExam().eventId()).isEqualTo(examId);
		assertThat(analysis.preparation().calendarDays()).isEqualTo(5);
		assertThat(analysis.preparation().note()).contains("2026-11-14");
		assertThat(analysis.missing()).anyMatch(note -> note.contains("original syllabus file is not stored"));
		assertThat(analysis.missing()).anyMatch(note -> note.contains("1 confirmed events have no weight saved."));
	}

	@Test
	void comparisonUsesCountsFromEachCourse() {
		UUID writing = UUID.randomUUID();
		UUID math = UUID.randomUUID();
		CourseAdvisor.Analysis analysis = CourseAdvisor.analyze(TODAY, List.of(
				course(writing, "ENG 220"),
				course(math, "MATH 140")), List.of(
				event(UUID.randomUUID(), writing, "Midterm", "EXAM", "2026-11-20", null, "Closed book"),
				event(UUID.randomUUID(), writing, "Essay", "ASSIGNMENT", "2026-11-18", null, null),
				event(UUID.randomUUID(), math, "Set 1", "ASSIGNMENT", "2026-11-12", null, null),
				event(UUID.randomUUID(), math, "Set 2", "ASSIGNMENT", "2026-11-13", null, null),
				event(UUID.randomUUID(), math, "Set 3", "ASSIGNMENT", "2026-11-16", null, null)));

		CourseAdvisor.CourseBrief english = analysis.courses().stream()
				.filter(course -> course.name().equals("ENG 220")).findFirst().orElseThrow();
		CourseAdvisor.CourseBrief mathematics = analysis.courses().stream()
				.filter(course -> course.name().equals("MATH 140")).findFirst().orElseThrow();
		assertThat(english.exams()).isEqualTo(1);
		assertThat(english.assignments()).isEqualTo(1);
		assertThat(mathematics.exams()).isZero();
		assertThat(mathematics.assignments()).isEqualTo(3);
		assertThat(analysis.nextExam().courseName()).isEqualTo("ENG 220");
		assertThat(analysis.examsWithinTwoWeeks()).extracting(CourseAdvisor.NextExam::title).containsExactly("Midterm");
	}

	@Test
	void factSheetCitesLabelsAndOmitsEventIds() {
		UUID eventId = UUID.randomUUID();
		UUID courseId = UUID.randomUUID();
		CourseAdvisor.Prompt prompt = CourseAdvisor.prompt(TODAY, List.of(course(courseId, "CS 310")), List.of(
				event(eventId, courseId, "Quiz", "QUIZ", "2026-11-12", null, "Chapter 3")));

		assertThat(prompt.text()).contains("Label A");
		assertThat(prompt.text()).contains("title Quiz");
		assertThat(prompt.text()).contains("quote Chapter 3");
		assertThat(prompt.text()).doesNotContain(eventId.toString());
		assertThat(prompt.labels()).containsEntry("A", eventId);
	}

	@Test
	void repliesDropInventedNumbersHoursAndGraduationClaims() {
		String facts = "Upcoming exams: 2\nLabel A | title Midterm | date 2026-11-14 | weight 25";
		assertThat(AdvisorReplies.keepAnswer("This assignment will take 8 hours.", facts)).isNull();
		assertThat(AdvisorReplies.keepAnswer("You will graduate if you pass.", facts)).isNull();
		assertThat(AdvisorReplies.keepAnswer("Spend 2 hours on the midterm.", facts)).isNull();
		assertThat(AdvisorReplies.keepAnswer("CS 310 is harder than MATH 140.", facts)).isNull();
		assertThat(AdvisorReplies.keepAnswer("You have 2 exams, including the midterm on 2026-11-14.", facts))
				.contains("2 exams");
		assertThat(AdvisorReplies.keepAnswer("Lab review is at 4:00.", "time 16:00-17:00")).contains("4:00");
		assertThat(AdvisorReplies.keepAnswer("CS 310 has 1 exam (Label C).", "Upcoming exams: 1\nCS 310"))
				.isEqualTo("CS 310 has 1 exam.");
		assertThat(AdvisorReplies.keepLabels(List.of("Label C"), java.util.Set.of("C"))).containsExactly("C");
		assertThat(AdvisorReplies.keepAnswer("The question asked about 9 items.", facts + "\nWhat about the 9 readings?"))
				.contains("9");
		assertThat(AdvisorReplies.keepLabels(List.of("a", "Z", "a"), java.util.Set.of("A"))).containsExactly("A");
	}

	@Test
	void modelTextKeepsOnlyTheStructuredFields() {
		AdvisorModel.ModelReply reply = AdvisorModel.read(JsonMapper.builder().build(), """
				{"answer":"Review the midterm.","citedEvents":["A", 4],"missing":["No office hours are saved."]}
				""");
		assertThat(reply.answer()).isEqualTo("Review the midterm.");
		assertThat(reply.citedEvents()).containsExactly("A");
		assertThat(reply.missing()).containsExactly("No office hours are saved.");
	}

	private static CourseAdvisor.CourseInput course(UUID id, String name) {
		return new CourseAdvisor.CourseInput(id, name, LocalDate.of(2026, 8, 25), LocalDate.of(2026, 12, 12));
	}

	private static CourseAdvisor.EventInput event(
			UUID id, UUID courseId, String title, String type, String date, BigDecimal weight, String quote) {
		return new CourseAdvisor.EventInput(
				id,
				courseId,
				title,
				type,
				LocalDate.parse(date),
				"EXAM".equals(type) ? LocalTime.of(14, 0) : null,
				"EXAM".equals(type) ? LocalTime.of(15, 30) : null,
				null,
				weight,
				quote == null ? null : "HIGH",
				quote);
	}
}
