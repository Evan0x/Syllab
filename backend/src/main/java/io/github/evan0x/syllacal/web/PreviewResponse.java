package io.github.evan0x.syllacal.web;

import java.util.List;

public record PreviewResponse(
    String courseName,
    List<CalendarEvent> events,
    List<String> warnings
) {}
