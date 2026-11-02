package io.github.evan0x.syllacal.web;

import java.util.List;

public record ExportRequest(String courseName, List<CalendarEvent> events) {
}
