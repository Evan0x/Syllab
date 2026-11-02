package io.github.evan0x.syllacal.web;

import java.time.LocalDate;
import java.time.LocalTime;

public record CalendarEvent(
		String title,
		String type,
		LocalDate date,
		LocalTime time,
		LocalTime endTime,
		String location,
		Double weightPercent,
		String confidence
) {
}
