package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.security.AccountUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RestController
public class EventController {

	private static final int MAX_EVENTS = 200;
	private static final Set<String> TYPES = Set.of("ASSIGNMENT", "EXAM", "QUIZ", "PROJECT", "ADMIN", "OTHER");
	private static final Set<String> CONFIDENCE = Set.of("HIGH", "MEDIUM", "LOW");

	private final JdbcTemplate jdbc;

	public EventController(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	@GetMapping("/api/events")
	public List<StoredEvent> list() {
		return confirmedEvents(MeController.currentUser().id(), null);
	}

	@GetMapping("/api/events/{id}")
	public ResponseEntity<?> read(@PathVariable String id) {
		StoredEvent event = findOwned(id, MeController.currentUser());
		if (event == null) {
			return missing();
		}
		return ResponseEntity.ok(event);
	}

	@PutMapping("/api/events")
	@Transactional
	public List<StoredEvent> save(@RequestBody CalendarSave save) {
		AccountUser user = MeController.currentUser();
		if (save == null || save.courseId() == null) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "courseId is required");
		}
		String courseName = save.courseName() == null ? "" : save.courseName().trim();
		if (courseName.isEmpty() || courseName.length() > 200) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Course name is required");
		}
		if (save.termStart() != null && save.termEnd() != null && save.termEnd().isBefore(save.termStart())) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Term end must be on or after the term start");
		}
		List<EventWrite> incoming = save.events() == null ? List.of() : save.events();
		List<PreparedEvent> prepared = new ArrayList<>();
		Set<UUID> ids = new LinkedHashSet<>();
		for (EventWrite event : incoming) {
			if (event == null || event.date() == null) {
				continue;
			}
			if (event.id() == null) {
				throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Event id is required");
			}
			if (!ids.add(event.id())) {
				throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Each event id can be saved once");
			}
			prepared.add(prepare(event));
		}
		if (prepared.size() > MAX_EVENTS) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "A calendar can hold 200 events");
		}
		UUID owner = courseOwner(save.courseId());
		if (owner != null && !owner.equals(user.id())) {
			throw new SyllabusRequestException(HttpStatus.NOT_FOUND, "Not found");
		}
		for (PreparedEvent event : prepared) {
			UUID eventOwner = eventOwner(event.id());
			if (eventOwner != null && !eventOwner.equals(user.id())) {
				throw new SyllabusRequestException(HttpStatus.NOT_FOUND, "Not found");
			}
		}
		if (owner == null) {
			jdbc.update(
					"insert into courses (id, user_id, name, term_start, term_end) values (?, ?, ?, ?, ?)",
					save.courseId(),
					user.id(),
					courseName,
					sqlDate(save.termStart()),
					sqlDate(save.termEnd()));
		} else {
			jdbc.update(
					"update courses set name = ?, term_start = ?, term_end = ? where id = ? and user_id = ?",
					courseName,
					sqlDate(save.termStart()),
					sqlDate(save.termEnd()),
					save.courseId(),
					user.id());
		}
		if (ids.isEmpty()) {
			jdbc.update("delete from events where user_id = ? and course_id = ?", user.id(), save.courseId());
		} else {
			StringBuilder sql = new StringBuilder(
					"delete from events where user_id = ? and course_id = ? and id not in (");
			List<Object> args = new ArrayList<>();
			args.add(user.id());
			args.add(save.courseId());
			int index = 0;
			for (UUID id : ids) {
				if (index > 0) {
					sql.append(", ");
				}
				sql.append('?');
				args.add(id);
				index++;
			}
			sql.append(')');
			jdbc.update(sql.toString(), args.toArray());
		}
		for (PreparedEvent event : prepared) {
			if (eventOwner(event.id()) == null) {
				jdbc.update("""
						insert into events (
							id, user_id, course_id, title, type, event_date, start_time, end_time,
							location, weight_percent, confidence, source_quote, review_status)
						values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
						""",
						event.id(),
						user.id(),
						save.courseId(),
						event.title(),
						event.type(),
						Date.valueOf(event.date()),
						sqlTime(event.time()),
						sqlTime(event.endTime()),
						event.location(),
						event.weightPercent(),
						event.confidence(),
						event.sourceQuote());
			} else {
				jdbc.update("""
						update events
						set title = ?, type = ?, event_date = ?, start_time = ?, end_time = ?,
							location = ?, weight_percent = ?, review_status = 'CONFIRMED', updated_at = now()
						where id = ? and user_id = ?
						""",
						event.title(),
						event.type(),
						Date.valueOf(event.date()),
						sqlTime(event.time()),
						sqlTime(event.endTime()),
						event.location(),
						event.weightPercent(),
						event.id(),
						user.id());
			}
		}
		return confirmedEvents(user.id(), save.courseId());
	}

	@PatchMapping("/api/events/{id}")
	public ResponseEntity<?> edit(@PathVariable String id, @RequestBody EventChange change) {
		AccountUser user = MeController.currentUser();
		UUID eventId = parse(id);
		if (eventId == null || !owned(eventId, user)) {
			return missing();
		}
		if (change == null || change.date() == null) {
			String title = change == null || change.title() == null ? "" : change.title().trim();
			if (title.isEmpty() || title.length() > 300) {
				return ResponseEntity.badRequest().body(new ApiError("Title is required"));
			}
			jdbc.update("update events set title = ?, updated_at = now() where id = ? and user_id = ?",
					title, eventId, user.id());
			return ResponseEntity.ok(findOwned(id, user));
		}
		PreparedEvent event = prepare(new EventWrite(
				eventId,
				change.title(),
				change.type(),
				change.date(),
				change.time(),
				change.endTime(),
				change.location(),
				change.weightPercent(),
				null,
				null));
		jdbc.update("""
				update events
				set title = ?, type = ?, event_date = ?, start_time = ?, end_time = ?,
					location = ?, weight_percent = ?, updated_at = now()
				where id = ? and user_id = ?
				""",
				event.title(),
				event.type(),
				Date.valueOf(event.date()),
				sqlTime(event.time()),
				sqlTime(event.endTime()),
				event.location(),
				event.weightPercent(),
				eventId,
				user.id());
		return ResponseEntity.ok(findOwned(id, user));
	}

	@PostMapping("/api/events/{id}/confirm")
	public ResponseEntity<?> confirm(@PathVariable String id) {
		AccountUser user = MeController.currentUser();
		UUID eventId = parse(id);
		if (eventId == null || !owned(eventId, user)) {
			return missing();
		}
		jdbc.update(
				"update events set review_status = 'CONFIRMED', updated_at = now() where id = ? and user_id = ?",
				eventId, user.id());
		return ResponseEntity.ok(findOwned(id, user));
	}

	@DeleteMapping("/api/events/{id}")
	public ResponseEntity<?> delete(@PathVariable String id) {
		AccountUser user = MeController.currentUser();
		UUID eventId = parse(id);
		if (eventId == null) {
			return missing();
		}
		int deleted = jdbc.update("delete from events where id = ? and user_id = ?", eventId, user.id());
		if (deleted == 0) {
			return missing();
		}
		return ResponseEntity.noContent().build();
	}

	private PreparedEvent prepare(EventWrite event) {
		String title = event.title() == null ? "" : event.title().trim();
		if (title.isEmpty() || title.length() > 300) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Title is required");
		}
		if (event.date() == null) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Date is required");
		}
		String type = event.type() == null || event.type().isBlank()
				? "OTHER"
				: event.type().trim().toUpperCase(Locale.ROOT);
		if (!TYPES.contains(type)) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Event type is not supported");
		}
		if (event.endTime() != null && event.time() == null) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Enter a start time, or leave the end time empty");
		}
		if (event.time() != null && event.endTime() != null && !event.endTime().isAfter(event.time())) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "End time must be after the start time");
		}
		String location = blankToNull(event.location());
		if (location != null && location.length() > 200) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Location is too long");
		}
		BigDecimal weight = weight(event.weightPercent());
		String confidence = confidence(event.confidence());
		String quote = blankToNull(event.sourceQuote());
		if (quote != null && quote.length() > 500) {
			quote = quote.substring(0, 500);
		}
		return new PreparedEvent(
				event.id(), title, type, event.date(), event.time(), event.endTime(), location, weight, confidence, quote);
	}

	private static BigDecimal weight(Double value) {
		if (value == null) {
			return null;
		}
		if (value < 0 || value > 100) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Weight must be between 0 and 100");
		}
		return BigDecimal.valueOf(value);
	}

	private static String confidence(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		String level = value.trim().toUpperCase(Locale.ROOT);
		return CONFIDENCE.contains(level) ? level : null;
	}

	private static String blankToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	private List<StoredEvent> confirmedEvents(UUID userId, UUID courseId) {
		String sql = """
				select e.id, e.course_id, c.name as course_name, e.title, e.type, e.event_date,
					e.start_time, e.end_time, e.location, e.weight_percent, e.confidence,
					e.source_quote, e.review_status
				from events e
				join courses c on c.id = e.course_id
				where e.user_id = ? and e.review_status = 'CONFIRMED'
				""";
		if (courseId == null) {
			sql += " order by e.event_date, e.start_time nulls last, e.title";
			return jdbc.query(sql, (rs, row) -> mapEvent(rs), userId);
		}
		sql += " and e.course_id = ? order by e.event_date, e.start_time nulls last, e.title";
		return jdbc.query(sql, (rs, row) -> mapEvent(rs), userId, courseId);
	}

	private StoredEvent findOwned(String id, AccountUser user) {
		UUID eventId = parse(id);
		if (eventId == null) {
			return null;
		}
		return jdbc.query("""
				select e.id, e.course_id, c.name as course_name, e.title, e.type, e.event_date,
					e.start_time, e.end_time, e.location, e.weight_percent, e.confidence,
					e.source_quote, e.review_status
				from events e
				join courses c on c.id = e.course_id
				where e.id = ? and e.user_id = ?
				""", (rs, row) -> mapEvent(rs), eventId, user.id())
				.stream()
				.findFirst()
				.orElse(null);
	}

	private static StoredEvent mapEvent(java.sql.ResultSet rs) throws java.sql.SQLException {
		Time start = rs.getTime("start_time");
		Time end = rs.getTime("end_time");
		BigDecimal weight = rs.getBigDecimal("weight_percent");
		return new StoredEvent(
				rs.getObject("id", UUID.class),
				rs.getObject("course_id", UUID.class),
				rs.getString("course_name"),
				rs.getString("title"),
				rs.getString("type"),
				rs.getDate("event_date").toLocalDate(),
				start == null ? null : start.toLocalTime(),
				end == null ? null : end.toLocalTime(),
				rs.getString("location"),
				weight == null ? null : weight.doubleValue(),
				rs.getString("confidence"),
				rs.getString("source_quote"),
				rs.getString("review_status"));
	}

	private UUID courseOwner(UUID courseId) {
		List<UUID> owners = jdbc.query(
				"select user_id from courses where id = ?",
				(rs, row) -> rs.getObject("user_id", UUID.class),
				courseId);
		return owners.isEmpty() ? null : owners.getFirst();
	}

	private UUID eventOwner(UUID eventId) {
		List<UUID> owners = jdbc.query(
				"select user_id from events where id = ?",
				(rs, row) -> rs.getObject("user_id", UUID.class),
				eventId);
		return owners.isEmpty() ? null : owners.getFirst();
	}

	private boolean owned(UUID eventId, AccountUser user) {
		Integer count = jdbc.queryForObject(
				"select count(*) from events where id = ? and user_id = ?",
				Integer.class,
				eventId,
				user.id());
		return count != null && count > 0;
	}

	private static Date sqlDate(LocalDate date) {
		return date == null ? null : Date.valueOf(date);
	}

	private static Time sqlTime(LocalTime time) {
		return time == null ? null : Time.valueOf(time);
	}

	private static UUID parse(String id) {
		try {
			return UUID.fromString(id);
		} catch (IllegalArgumentException exception) {
			return null;
		}
	}

	private static ResponseEntity<ApiError> missing() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("Not found"));
	}

	public record CalendarSave(
			UUID courseId,
			String courseName,
			LocalDate termStart,
			LocalDate termEnd,
			List<EventWrite> events) {
	}

	public record EventWrite(
			UUID id,
			String title,
			String type,
			LocalDate date,
			LocalTime time,
			LocalTime endTime,
			String location,
			Double weightPercent,
			String confidence,
			String sourceQuote) {
	}

	public record EventChange(
			String title,
			String type,
			LocalDate date,
			LocalTime time,
			LocalTime endTime,
			String location,
			Double weightPercent) {
	}

	public record StoredEvent(
			UUID id,
			UUID courseId,
			String courseName,
			String title,
			String type,
			LocalDate date,
			LocalTime time,
			LocalTime endTime,
			String location,
			Double weightPercent,
			String confidence,
			String sourceQuote,
			String reviewStatus) {
	}

	private record PreparedEvent(
			UUID id,
			String title,
			String type,
			LocalDate date,
			LocalTime time,
			LocalTime endTime,
			String location,
			BigDecimal weightPercent,
			String confidence,
			String sourceQuote) {
	}
}
