package io.github.evan0x.syllacal.term;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TermTest {

    private static final ZoneId ZONE = ZoneId.of("America/New_York");

    @Test
    void keepsMondayStartEndAndSkippedWeeks() {
        Set<Integer> skipped = new HashSet<>();
        skipped.add(8);

        Term fall = new Term(
                LocalDate.of(2025, 8, 25),
                LocalDate.of(2025, 12, 18),
                skipped,
                ZONE);

        skipped.add(9);

        assertEquals(LocalDate.of(2025, 8, 25), fall.firstDay());
        assertEquals(LocalDate.of(2025, 12, 18), fall.lastDay());
        assertEquals(Set.of(8), fall.skippedCalendarWeeks());
        assertEquals(ZONE, fall.zone());
    }

    @Test
    void rejectsFirstDayThatIsNotMonday() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> new Term(
                LocalDate.of(2025, 8, 26),
                LocalDate.of(2025, 12, 18),
                Set.of(),
                ZONE));

        assertEquals("firstDay must be a Monday: 2025-08-26", error.getMessage());
    }

    @Test
    void rejectsLastDayBeforeFirstDay() {
        assertThrows(IllegalArgumentException.class, () -> new Term(
                LocalDate.of(2025, 8, 25),
                LocalDate.of(2025, 8, 18),
                Set.of(),
                ZONE));
    }
}
