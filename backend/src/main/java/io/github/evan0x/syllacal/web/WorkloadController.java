package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.security.AccountUser;
import io.github.evan0x.syllacal.workload.GeminiWorkloadModel;
import io.github.evan0x.syllacal.workload.WorkloadCalculator;
import io.github.evan0x.syllacal.workload.WorkloadCalculator.CourseInput;
import io.github.evan0x.syllacal.workload.WorkloadCalculator.EventInput;
import io.github.evan0x.syllacal.workload.WorkloadCalculator.Report;
import io.github.evan0x.syllacal.workload.WorkloadSuggestions;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@RestController
public class WorkloadController {

	private static final ZoneId CALENDAR_ZONE = ZoneId.of("America/New_York");

	private final JdbcTemplate jdbc;
	private final GeminiWorkloadModel suggestions;

	public WorkloadController(JdbcTemplate jdbc, GeminiWorkloadModel suggestions) {
		this.jdbc = jdbc;
		this.suggestions = suggestions;
	}

	@GetMapping("/api/workload")
	public Report workload(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
		return calculate(MeController.currentUser(), today);
	}

	@PostMapping("/api/workload/insights")
	public InsightResponse insights(@RequestBody(required = false) TodayRequest request) {
		Report report = calculate(MeController.currentUser(), request == null ? null : request.today());
		String sheet = WorkloadCalculator.insightSheet(report);
		if (!suggestions.available() || sheet.isBlank()) {
			return new InsightResponse(false, List.of());
		}
		try {
			return new InsightResponse(true, WorkloadSuggestions.keep(suggestions.complete(sheet), sheet));
		}
		catch (RuntimeException exception) {
			return new InsightResponse(false, List.of());
		}
	}

	private Report calculate(AccountUser user, LocalDate today) {
		LocalDate day = today == null ? LocalDate.now(CALENDAR_ZONE) : today;
		return WorkloadCalculator.calculate(day, courses(user.id()), events(user.id()));
	}

	private List<CourseInput> courses(UUID userId) {
		return jdbc.query("""
				select id, name, term_start, term_end
				from courses
				where user_id = ?
				order by name, term_start
				""", (rs, row) -> new CourseInput(
				rs.getObject("id", UUID.class),
				rs.getString("name"),
				sqlDate(rs.getDate("term_start")),
				sqlDate(rs.getDate("term_end"))), userId);
	}

	private List<EventInput> events(UUID userId) {
		return jdbc.query("""
				select id, course_id, title, type, event_date, start_time, end_time, weight_percent
				from events
				where user_id = ? and review_status = 'CONFIRMED'
				order by event_date, start_time nulls last, title
				""", (rs, row) -> {
			java.sql.Time start = rs.getTime("start_time");
			java.sql.Time end = rs.getTime("end_time");
			BigDecimal weight = rs.getBigDecimal("weight_percent");
			return new EventInput(
					rs.getObject("id", UUID.class),
					rs.getObject("course_id", UUID.class),
					rs.getString("title"),
					rs.getString("type"),
					rs.getDate("event_date").toLocalDate(),
					start == null ? null : start.toLocalTime(),
					end == null ? null : end.toLocalTime(),
					weight == null ? null : weight.stripTrailingZeros());
		}, userId);
	}

	private static LocalDate sqlDate(Date date) {
		return date == null ? null : date.toLocalDate();
	}

	public record TodayRequest(LocalDate today) {
	}

	public record InsightResponse(boolean available, List<String> suggestions) {
	}
}
