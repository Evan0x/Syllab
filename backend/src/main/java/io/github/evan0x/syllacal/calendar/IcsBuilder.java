package io.github.evan0x.syllacal.calendar;

import io.github.evan0x.syllacal.extraction.ExtractedEvent;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.Description;
import net.fortuna.ical4j.model.property.Location;
import net.fortuna.ical4j.model.property.ProdId;
import net.fortuna.ical4j.model.property.Uid;
import net.fortuna.ical4j.model.property.immutable.ImmutableCalScale;
import net.fortuna.ical4j.model.property.immutable.ImmutableVersion;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Builds an iCalendar (.ics) document from extracted events.
 *
 * <p>Uses ical4j 4.x Temporal API: {@link LocalDate} for all-day DATE values and
 * {@link ZonedDateTime} for DATE-TIME values with a TZID. See
 * <a href="https://github.com/ical4j/ical4j">ical4j README</a> and
 * <a href="https://www.ical4j.org/examples/model/">model examples</a>.
 */
public class IcsBuilder {

	public String build(List<ExtractedEvent> events, String courseName) {
		return build(events, courseName, ZoneId.of("America/New_York"));
	}

	public String build(List<ExtractedEvent> events, String courseName, ZoneId timeZone) {
		Objects.requireNonNull(events, "events");
		Objects.requireNonNull(courseName, "courseName");
		Objects.requireNonNull(timeZone, "timeZone");
	
		Calendar calendar = new Calendar();
		calendar.add(new ProdId("-//SyllaCal//EN"));
		calendar.add(ImmutableVersion.VERSION_2_0);
		calendar.add(ImmutableCalScale.GREGORIAN);
	
		// fixed order, so the position within a day does not depend on input order
		List<ExtractedEvent> dated = events.stream()
				.filter(e -> e.date() != null)
				.sorted(Comparator.comparing(ExtractedEvent::date)
						.thenComparing(e -> Objects.toString(e.title(), "").toLowerCase(Locale.ROOT)))
				.toList();
	
		Map<LocalDate, Integer> seenOnDay = new HashMap<>();
		for (ExtractedEvent event : dated) {
			int indexOnDay = seenOnDay.merge(event.date(), 1, Integer::sum) - 1;
			calendar.add(toVEvent(event, courseName, timeZone, indexOnDay));
		}
		return calendar.toString();
	}

	private static VEvent toVEvent(ExtractedEvent event, String courseName, ZoneId timeZone, int indexOnDay) {
		String summary = event.title() == null ? courseName : event.title();
		VEvent vevent;

		if (event.time() == null) {
		// all-day event: no DTEND
		vevent = new VEvent(event.date(), summary);
		}
		else {
		ZonedDateTime start = ZonedDateTime.of(event.date(), event.time(), timeZone);
		if (event.endTime() != null && event.endTime().isAfter(event.time())) {
		ZonedDateTime end = ZonedDateTime.of(event.date(), event.endTime(), timeZone);
		vevent = new VEvent(start, end, summary);
		}
		else {
		// no end time, or an end time that is not after the start: skip DTEND
		vevent = new VEvent(start, summary);
		}
		}

		if (event.location() != null && !event.location().isBlank()) {
		vevent.add(new Location(event.location().trim()));
		}
		vevent.add(new Uid(stableUid(courseName, event.date(), indexOnDay)));
		vevent.add(new Description(buildDescription(event)));
		return vevent;
	}

	static String stableUid(String courseName, LocalDate date, int indexOnDay) {
		String course = Objects.toString(courseName, "").trim().toLowerCase(Locale.ROOT);
		String material = course + "|" + date + "|" + indexOnDay;
		return UUID.nameUUIDFromBytes(material.getBytes(StandardCharsets.UTF_8)) + "@syllacal";
	}



	private static String buildDescription(ExtractedEvent event) {
		StringBuilder description = new StringBuilder();
		if (event.weightPercent() != null) {
			double weight = event.weightPercent();
			String weightText = weight == Math.rint(weight)
					? Long.toString(Math.round(weight))
					: Double.toString(weight);
			description.append("Weight: ").append(weightText).append('%');
		}
		if (event.sourceText() != null && !event.sourceText().isBlank()) {
			if (!description.isEmpty()) {
				description.append('\n');
			}
			description.append("Source: ").append(event.sourceText());
		}
		return description.toString();
	}
}
