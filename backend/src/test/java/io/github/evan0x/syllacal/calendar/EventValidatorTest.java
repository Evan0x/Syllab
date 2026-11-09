package io.github.evan0x.syllacal.calendar;

import io.github.evan0x.syllacal.extraction.ExtractedEvent;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EventValidatorTest {

	private static final String QUOTE = "Listed on the weekly plan.";
	private static final String SYLLABUS = "Listed on the weekly plan. Bring a pencil.";

	private final EventValidator validator = new EventValidator();
	private final LocalDate termStart = LocalDate.of(2026, 8, 24);
	private final LocalDate termEnd = LocalDate.of(2026, 12, 16);

	@Test
	void dropsEventsWithNullDate() {
		ExtractedEvent withDate = event("Exam 1", LocalDate.of(2026, 9, 30), "HIGH");
		ExtractedEvent noDate = event("Homework", null, "MEDIUM");

		ValidationResult result = validator.validate(List.of(withDate, noDate), termStart, termEnd, SYLLABUS);

		assertEquals(1, result.validEvents().size());
		assertEquals("Exam 1", result.validEvents().getFirst().title());
		assertTrue(result.warnings().stream().anyMatch(w -> w.contains("null date")));
	}

	@Test
	void flagsButKeepsOutOfRangeDates() {
		ExtractedEvent outside = event("Summer Work", LocalDate.of(2026, 7, 1), "HIGH");

		ValidationResult result = validator.validate(List.of(outside), termStart, termEnd, SYLLABUS);

		assertEquals(1, result.validEvents().size());
		assertTrue(result.warnings().stream().anyMatch(w -> w.contains("outside term range")));
	}

	@Test
	void mergesExactDuplicatesByTitleAndDate() {
		ExtractedEvent first = event("Exam 1", LocalDate.of(2026, 9, 30), "HIGH");
		ExtractedEvent duplicate = event("Exam 1", LocalDate.of(2026, 9, 30), "MEDIUM");

		ValidationResult result = validator.validate(List.of(first, duplicate), termStart, termEnd, SYLLABUS);

		assertEquals(1, result.validEvents().size());
		assertEquals("HIGH", result.validEvents().getFirst().confidence());
		assertTrue(result.warnings().stream().anyMatch(w -> w.contains("duplicate")));
	}

	@Test
	void keepsLowConfidenceButMarksThem() {
		ExtractedEvent low = event("Quiz", LocalDate.of(2026, 10, 1), "LOW");

		ValidationResult result = validator.validate(List.of(low), termStart, termEnd, SYLLABUS);

		assertEquals(1, result.validEvents().size());
		assertTrue(result.warnings().stream().anyMatch(w -> w.contains("LOW confidence")));
	}

	@Test
	void presentQuoteKeepsHighAndMediumConfidence() {
		LocalDate date = LocalDate.of(2026, 9, 30);
		ExtractedEvent high = event("Exam 1", date, "HIGH");
		ExtractedEvent medium = event("Quiz", date.plusDays(1), "MEDIUM");

		ValidationResult result = validator.validate(List.of(high, medium), termStart, termEnd, SYLLABUS);

		assertEquals("HIGH", result.validEvents().get(0).confidence());
		assertEquals("MEDIUM", result.validEvents().get(1).confidence());
	}

	@Test
	void missingQuoteLowersConfidenceAndWarns() {
		String quote = "Bring a purple folder.";
		ExtractedEvent event = event("Exam 1", LocalDate.of(2026, 9, 30), "HIGH", quote);

		ValidationResult result = validator.validate(List.of(event), termStart, termEnd, SYLLABUS);

		assertEquals("LOW", result.validEvents().getFirst().confidence());
		assertTrue(result.warnings().stream().anyMatch(w -> w.contains("Exam 1") && w.contains("2026-09-30")));
		assertTrue(result.warnings().stream().noneMatch(w -> w.contains(quote) || w.contains("Bring a pencil")));
	}

	@Test
	void nullOrBlankQuoteLowersConfidenceAndWarns() {
		LocalDate date = LocalDate.of(2026, 9, 30);
		ExtractedEvent missing = event("Exam 1", date, "HIGH", null);
		ExtractedEvent blank = event("Quiz", date.plusDays(1), "MEDIUM", " \n\t ");

		ValidationResult result = validator.validate(List.of(missing, blank), termStart, termEnd, SYLLABUS);

		assertEquals("LOW", result.validEvents().get(0).confidence());
		assertEquals("LOW", result.validEvents().get(1).confidence());
		assertEquals(2, result.warnings().stream().filter(w -> w.contains("no source quote")).count());
	}

	@Test
	void alreadyLowQuoteStaysLow() {
		ExtractedEvent low = event("Quiz", LocalDate.of(2026, 10, 1), "LOW", null);

		ValidationResult result = validator.validate(List.of(low), termStart, termEnd, SYLLABUS);

		assertEquals("LOW", result.validEvents().getFirst().confidence());
	}

	@Test
	void highConfidenceIsNeverRaised() {
		ExtractedEvent high = event("Exam 1", LocalDate.of(2026, 9, 30), "HIGH");

		ValidationResult result = validator.validate(List.of(high), termStart, termEnd, SYLLABUS);

		assertEquals("HIGH", result.validEvents().getFirst().confidence());
	}

	@Test
	void keepsTheHigherConfidenceDuplicate() {
		LocalDate date = LocalDate.of(2026, 9, 30);
		ValidationResult lowThenHigh = validator.validate(
				List.of(event("Exam 1", date, "LOW"), event("Exam 1", date, "HIGH")),
				termStart, termEnd, SYLLABUS);
		assertEquals("HIGH", lowThenHigh.validEvents().getFirst().confidence());

		ValidationResult highThenLow = validator.validate(
				List.of(event("Exam 1", date, "HIGH"), event("Exam 1", date, "LOW")),
				termStart, termEnd, SYLLABUS);
		assertEquals("HIGH", highThenLow.validEvents().getFirst().confidence());
	}

	@Test
	void equalConfidenceKeepsTheFirstDuplicate() {
		LocalDate date = LocalDate.of(2026, 9, 30);
		ExtractedEvent first = new ExtractedEvent(
				"Exam 1", "EXAM", date, null, null, "Room A", 20.0, "MEDIUM", QUOTE);
		ExtractedEvent second = new ExtractedEvent(
				"Exam 1", "EXAM", date, null, null, "Room B", 20.0, "MEDIUM", QUOTE);

		ValidationResult result = validator.validate(List.of(first, second), termStart, termEnd, SYLLABUS);

		assertEquals("Room A", result.validEvents().getFirst().location());
		assertEquals("MEDIUM", result.validEvents().getFirst().confidence());
	}

	@Test
	void nullConfidenceDoesNotThrow() {
		ExtractedEvent missing = event("Exam 1", LocalDate.of(2026, 9, 30), null);

		ValidationResult result = validator.validate(List.of(missing), termStart, termEnd, SYLLABUS);

		assertEquals(1, result.validEvents().size());
		assertNull(result.validEvents().getFirst().confidence());
	}

	private static ExtractedEvent event(String title, LocalDate date, String confidence) {
		return event(title, date, confidence, QUOTE);
	}

	private static ExtractedEvent event(String title, LocalDate date, String confidence, String sourceText) {
		return new ExtractedEvent(title, "EXAM", date, null, null, null, 20.0, confidence, sourceText);
	}
}
