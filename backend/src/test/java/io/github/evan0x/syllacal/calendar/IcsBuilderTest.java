package io.github.evan0x.syllacal.calendar;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.evan0x.syllacal.extraction.ExtractedEvent;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class IcsBuilderTest {

    private final IcsBuilder builder = new IcsBuilder();

    private static ExtractedEvent event(String title, LocalDate date) {
        return new ExtractedEvent(title, "EXAM", date, null, null, null, null, "HIGH", "src");
    }

    private static List<String> uids(String ics) {
        return ics.lines().filter(l -> l.startsWith("UID:")).toList();
    }

    private static final LocalDate D = LocalDate.of(2026, 9, 30);

    @Test
    @DisplayName("Same course and date, different title: same UID")
    void titleDoesNotAffectUid() {
        String a = builder.build(List.of(event("Exam 1", D)), "MATH 114");
        String b = builder.build(List.of(event("Exam 1 (Ch 6-7.4)", D)), "MATH 114");
        assertThat(uids(a)).isEqualTo(uids(b));
    }

    @Test
    @DisplayName("Different dates: different UIDs")
    void differentDatesDiffer() {
        String a = builder.build(List.of(event("Exam", D)), "MATH 114");
        String b = builder.build(List.of(event("Exam", D.plusDays(1))), "MATH 114");
        assertThat(uids(a)).isNotEqualTo(uids(b));
    }

    @Test
    @DisplayName("Two events on the same day: different UIDs")
    void sameDayEventsDoNotCollide() {
        String ics = builder.build(List.of(event("A", D), event("B", D)), "MATH 114");
        assertThat(new HashSet<>(uids(ics))).hasSize(2);
    }

    @Test
    @DisplayName("Course name case and spaces do not matter")
    void courseNameIsNormalized() {
        String a = builder.build(List.of(event("Exam", D)), "MATH 125");
        String b = builder.build(List.of(event("Exam", D)), "  math 125 ");
        assertThat(uids(a)).isEqualTo(uids(b));
    }

    @Test
    @DisplayName("Input order does not change the set of UIDs")
    void inputOrderDoesNotMatter() {
        String a = builder.build(List.of(event("A", D), event("B", D)), "MATH 114");
        String b = builder.build(List.of(event("B", D), event("A", D)), "MATH 114");
        assertThat(new HashSet<>(uids(a))).isEqualTo(new HashSet<>(uids(b)));
    }
}