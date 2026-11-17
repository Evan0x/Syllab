package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.security.AccountUser;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
public class CourseController {

	private final JdbcTemplate jdbc;

	public CourseController(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	@GetMapping("/api/courses")
	public List<CourseView> list() {
		UUID userId = MeController.currentUser().id();
		return jdbc.query("""
				select c.id, c.name, c.term_start, c.term_end,
					count(e.id) as event_count
				from courses c
				left join events e on e.course_id = c.id and e.review_status = 'CONFIRMED'
				where c.user_id = ?
				group by c.id, c.name, c.term_start, c.term_end, c.created_at
				order by c.created_at desc
				""", (rs, row) -> {
			Date start = rs.getDate("term_start");
			Date end = rs.getDate("term_end");
			return new CourseView(
					rs.getObject("id", UUID.class),
					rs.getString("name"),
					start == null ? null : start.toLocalDate(),
					end == null ? null : end.toLocalDate(),
					rs.getLong("event_count"));
		}, userId);
	}

	@PatchMapping("/api/courses/{id}")
	@Transactional
	public ResponseEntity<?> update(@PathVariable String id, @RequestBody CourseUpdate update) {
		AccountUser user = MeController.currentUser();
		UUID courseId = parse(id);
		if (courseId == null || !owned(courseId, user.id())) {
			return missing();
		}
		String name = update.name() == null ? null : update.name().trim();
		if (name == null || name.isEmpty()) {
			return ResponseEntity.badRequest().body(new ApiError("Course name is required"));
		}
		if (name.length() > 200) {
			return ResponseEntity.badRequest().body(new ApiError("Course name must be at most 200 characters"));
		}
		if (update.termStart() != null && update.termEnd() != null && update.termEnd().isBefore(update.termStart())) {
			return ResponseEntity.badRequest().body(new ApiError("Term end must be on or after term start"));
		}
		jdbc.update("""
				update courses set name = ?, term_start = ?, term_end = ?
				where id = ? and user_id = ?
				""",
				name,
				update.termStart() != null ? Date.valueOf(update.termStart()) : null,
				update.termEnd() != null ? Date.valueOf(update.termEnd()) : null,
				courseId,
				user.id());
		return ResponseEntity.ok(findCourse(courseId, user.id()));
	}

	@DeleteMapping("/api/courses/{id}")
	@Transactional
	public ResponseEntity<Void> delete(@PathVariable String id) {
		AccountUser user = MeController.currentUser();
		UUID courseId = parse(id);
		if (courseId == null) {
			return ResponseEntity.notFound().build();
		}
		int deleted = jdbc.update("delete from courses where id = ? and user_id = ?", courseId, user.id());
		if (deleted == 0) {
			return ResponseEntity.notFound().build();
		}
		return ResponseEntity.noContent().build();
	}

	private boolean owned(UUID courseId, UUID userId) {
		Integer count = jdbc.queryForObject(
				"select count(*) from courses where id = ? and user_id = ?",
				Integer.class, courseId, userId);
		return count != null && count > 0;
	}

	private CourseView findCourse(UUID courseId, UUID userId) {
		return jdbc.query("""
				select c.id, c.name, c.term_start, c.term_end,
					count(e.id) as event_count
				from courses c
				left join events e on e.course_id = c.id and e.review_status = 'CONFIRMED'
				where c.id = ? and c.user_id = ?
				group by c.id, c.name, c.term_start, c.term_end, c.created_at
				""", (rs, row) -> {
			Date start = rs.getDate("term_start");
			Date end = rs.getDate("term_end");
			return new CourseView(
					rs.getObject("id", UUID.class),
					rs.getString("name"),
					start == null ? null : start.toLocalDate(),
					end == null ? null : end.toLocalDate(),
					rs.getLong("event_count"));
		}, courseId, userId).stream().findFirst().orElse(null);
	}

	private static UUID parse(String id) {
		try {
			return UUID.fromString(id);
		} catch (IllegalArgumentException e) {
			return null;
		}
	}

	private static ResponseEntity<ApiError> missing() {
		return ResponseEntity.notFound().build();
	}

	public record CourseView(UUID id, String name, LocalDate termStart, LocalDate termEnd, long eventCount) {}

	public record CourseUpdate(String name, LocalDate termStart, LocalDate termEnd) {}
}
