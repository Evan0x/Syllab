package io.github.evan0x.syllacal.calendar;

import io.github.evan0x.syllacal.extraction.ExtractedEvent;
import io.github.evan0x.syllacal.extraction.QuoteVerifier;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class EventValidator {

	private final QuoteVerifier quoteVerifier = new QuoteVerifier();

	public ValidationResult validate(
			List<ExtractedEvent> events, LocalDate termStart, LocalDate termEnd, String syllabusText) {
		Objects.requireNonNull(events, "events");
		Objects.requireNonNull(termStart, "termStart");
		Objects.requireNonNull(termEnd, "termEnd");
		Objects.requireNonNull(syllabusText, "syllabusText");

		List<String> warnings = new ArrayList<>();
		Map<String, ExtractedEvent> byTitleAndDate = new LinkedHashMap<>();

		for (ExtractedEvent event : events) {
			if (event.date() == null) {
				warnings.add("Dropped event with null date: " + safeTitle(event));
				continue;
			}

			if (event.date().isBefore(termStart) || event.date().isAfter(termEnd)) {
				warnings.add("Event outside term range [" + termStart + ", " + termEnd + "]: "
						+ safeTitle(event) + " on " + event.date());
			}

			//if confidence is LOW, add a warning
			if ("LOW".equalsIgnoreCase(event.confidence())) {
				warnings.add("LOW confidence event kept: " + safeTitle(event) + " on " + event.date());
			}

			ExtractedEvent checked = verifyQuote(event, syllabusText, warnings);
			String key = safeTitle(checked) + "|" + checked.date();
			ExtractedEvent kept = byTitleAndDate.get(key);
			if (kept != null) {
				warnings.add("Merged duplicate event: " + safeTitle(checked) + " on " + checked.date());
				if (confidenceRank(checked) > confidenceRank(kept)) {
					byTitleAndDate.put(key, checked);
				}
				continue;
			}
			byTitleAndDate.put(key, checked);
		}

		return new ValidationResult(List.copyOf(byTitleAndDate.values()), List.copyOf(warnings));
	}

	private ExtractedEvent verifyQuote(ExtractedEvent event, String syllabusText, List<String> warnings) {
		String quote = event.sourceText();
		if (quote == null || quote.isBlank()) {
			warnings.add("Event has no source quote: " + safeTitle(event) + " on " + event.date());
			return withLowConfidence(event);
		}
		if (!quoteVerifier.appearsIn(quote, syllabusText)) {
			warnings.add("Source quote not found in the syllabus text: " + safeTitle(event) + " on " + event.date());
			return withLowConfidence(event);
		}
		return event;
	}

	private static ExtractedEvent withLowConfidence(ExtractedEvent event) {
		if (event.confidence() != null && event.confidence().equalsIgnoreCase("LOW")) {
			return event;
		}
		return new ExtractedEvent(
				event.title(),
				event.type(),
				event.date(),
				event.time(),
				event.endTime(),
				event.location(),
				event.weightPercent(),
				"LOW",
				event.sourceText());
	}

	private static int confidenceRank(ExtractedEvent event) {
		String confidence = event.confidence();
		if ("HIGH".equalsIgnoreCase(confidence)) {
			return 2;
		}
		if ("MEDIUM".equalsIgnoreCase(confidence)) {
			return 1;
		}
		return 0;
	}

	private static String safeTitle(ExtractedEvent event) {
		return event.title() == null ? "(untitled)" : event.title();
	}
}
