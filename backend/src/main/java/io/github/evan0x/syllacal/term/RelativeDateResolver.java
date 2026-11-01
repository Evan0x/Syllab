package io.github.evan0x.syllacal.term;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class RelativeDateResolver {

    // 1. patterns go at the top of the class, outside any method
    private static final Pattern WEEK_FIRST = Pattern.compile(
            "(?:week|wk)\\s+(\\d+),?\\s+(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern DAY_FIRST = Pattern.compile(
            "(\\w+)\\s+of\\s+(?:week|wk)\\s+(\\d+)", Pattern.CASE_INSENSITIVE);

    // 2. the main method
    public Optional<LocalDate> resolve(String text, Term term) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        String t = text.trim();
        Matcher m1 = WEEK_FIRST.matcher(t);
        Matcher m2 = DAY_FIRST.matcher(t);

        String weekText;
        String dayText;
        if (m1.matches()) {
            weekText = m1.group(1);
            dayText = m1.group(2);
        } else if (m2.matches()) {
            weekText = m2.group(2);     // swapped: week number comes second here
            dayText = m2.group(1);
        } else {
            return Optional.empty();
        }

        int week;
        try {
            week = Integer.parseInt(weekText);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
        Optional<DayOfWeek> day = parseDay(dayText);
        if (day.isEmpty()) {
            return Optional.empty();
        }

        long calendarWeeksInTerm = ChronoUnit.WEEKS.between(term.firstDay(), term.lastDay()) + 1;
        if (week < 1 || week > calendarWeeksInTerm) {
            return Optional.empty();
        }

        int calendarWeek = toCalendarWeek(week, term);

        LocalDate result = term.firstDay()
                .plusWeeks(calendarWeek - 1)
                .plusDays(day.get().getValue() - 1);
        if (result.isAfter(term.lastDay())) {
            return Optional.empty();
        }
        return Optional.of(result);
    }

    // 3. helper method goes below resolve(), still inside the class
    private static Optional<DayOfWeek> parseDay(String text) {
        String t = text.toLowerCase();
        for (DayOfWeek d : DayOfWeek.values()) {
            String full = d.name().toLowerCase();     // e.g. "friday"
            if (t.equals(full) || t.equals(full.substring(0, 3))) {
                return Optional.of(d);
            }
        }
        return Optional.empty();
    }

    // 4. converts an instructional week number into a calendar week number
    private static int toCalendarWeek(int instructionalWeek, Term term) {
        int calendarWeek = 0;            // start one before week 1
        int counted = 0;                 // how many instructional weeks seen so far
        while (counted < instructionalWeek) {
            calendarWeek++;
            if (!term.skippedCalendarWeeks().contains(calendarWeek)) {
                counted++;
            }
        }
        return calendarWeek;
    }
}