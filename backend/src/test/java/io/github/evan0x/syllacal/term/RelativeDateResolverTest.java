package io.github.evan0x.syllacal.term;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;


class RelativeDateResolverTest {

    private final RelativeDateResolver resolver = new RelativeDateResolver();
    private static final ZoneId NY = ZoneId.of("America/New_York");

    // Spring term: starts Monday 1/18, ends Sunday 5/9.
    // Calendar week 9 (3/15 - 3/21) is spring break and is skipped.
    // Instructional weeks 1-8 = calendar weeks 1-8; weeks 9-15 = calendar weeks 10-16.
    private final Term spring = new Term(
            LocalDate.of(2027, 1, 18), LocalDate.of(2027, 5, 9), Set.of(9), NY);

    // Very short term: last day is Wednesday 1/27.
    private final Term shortTerm = new Term(
            LocalDate.of(2027, 1, 18), LocalDate.of(2027, 1, 27), Set.of(), NY);

    // Term that crosses New Year: 2026-12-14 to 2027-01-31.
    private final Term winter = new Term(
            LocalDate.of(2026, 12, 14), LocalDate.of(2027, 1, 31), Set.of(), NY);

    @ParameterizedTest
    @CsvSource({
            "Monday, 2027-01-18", "Tuesday, 2027-01-19", "Wednesday, 2027-01-20",
            "Thursday, 2027-01-21", "Friday, 2027-01-22", "Saturday, 2027-01-23",
            "Sunday, 2027-01-24"})
    @DisplayName("Week 1: Monday is firstDay, Sunday is the last day of that week")
    void weekOneEachDay(String day, LocalDate expected) {
        assertThat(resolver.resolve("Week 1 " + day, spring)).contains(expected);
    }

    @Test
    @DisplayName("Week 5 Friday in the spring term")
    void week5Friday() {
        assertThat(resolver.resolve("Week 5 Friday", spring))
                .contains(LocalDate.of(2027, 2, 19));
    }

    @Test
    @DisplayName("Unrecognized text returns empty")
    void lastDayIsNotSupported() {
        assertThat(resolver.resolve("Last day", shortTerm)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Week 5 Friday", "Wk 5 Fri", "Week 5, Friday", "Friday of Week 5",
            "week 5 friday", "WEEK 5 FRIDAY", "  Week   5   Friday  "})
    @DisplayName("All four formats, any case, extra spaces resolve to the same date")
    void inputFormats(String text) {
        assertThat(resolver.resolve(text, spring)).contains(LocalDate.of(2027, 2, 19));
    }

    @ParameterizedTest
    @CsvSource({
            "Week 8 Friday, 2027-03-12",
            "Week 9 Monday, 2027-03-22",
            "Week 9 Friday, 2027-03-26",
            "Week 10 Monday, 2027-03-29"})
    @DisplayName("Skipped break week is not counted as an instructional week")
    void skippedWeek(String text, LocalDate expected) {
        assertThat(resolver.resolve(text, spring)).contains(expected);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   ", "\t", "\n"})
    @DisplayName("Null or blank text returns empty")
    void nullOrBlank(String text) {
        assertThat(resolver.resolve(text, spring)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Week 99999999999 Monday", "Week 999999999999999 Monday"})
    @DisplayName("Week numbers that do not fit in an int return empty")
    void weekNumberOverflow(String text) {
        assertThat(resolver.resolve(text, spring)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Week 0 Monday", "Week 100 Monday", "Week 17 Monday", "Week 2147483647 Monday"})
    @DisplayName("Week numbers outside the term return empty")
    void weekOutsideTerm(String text) {
        assertThat(resolver.resolve(text, spring)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Week 16 Monday", "Week 16 Sunday", "Week -1 Monday", "Week -1 Friday"})
    @DisplayName("A date past the last day, or a negative week, returns empty")
    void datePastEndOrNegative(String text) {
        assertThat(resolver.resolve(text, spring)).isEmpty();
    }
}