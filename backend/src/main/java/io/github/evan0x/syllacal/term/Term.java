package io.github.evan0x.syllacal.term;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import java.util.Set;

/**
 * Calendar information for one academic term.
 *
 * @param firstDay             Monday of instructional week 1
 * @param lastDay              last day of the term
 * @param skippedCalendarWeeks calendar-week indexes (1 = the week containing firstDay)
 *                             that do not count as instructional weeks, e.g. spring break
 * @param zone                 the school's time zone
 */
public record Term(
        LocalDate firstDay,
        LocalDate lastDay,
        Set<Integer> skippedCalendarWeeks,
        ZoneId zone) {

    public Term {
        Objects.requireNonNull(firstDay, "firstDay");
        Objects.requireNonNull(lastDay, "lastDay");
        Objects.requireNonNull(skippedCalendarWeeks, "skippedCalendarWeeks");
        Objects.requireNonNull(zone, "zone");
        if (firstDay.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new IllegalArgumentException("firstDay must be a Monday: " + firstDay);
        }
        if (lastDay.isBefore(firstDay)) {
            throw new IllegalArgumentException("lastDay is before firstDay");
        }
        skippedCalendarWeeks = Set.copyOf(skippedCalendarWeeks);
    }
}