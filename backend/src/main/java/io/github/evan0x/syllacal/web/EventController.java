package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.security.AccountUser;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class EventController {

	private final JdbcTemplate jdbc;

	public EventController(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	@GetMapping("/api/events/{id}")
	public ResponseEntity<?> read(@PathVariable String id) {
		EventView event = findOwned(id, MeController.currentUser());
		if (event == null) {
			return missing();
		}
		return ResponseEntity.ok(event);
	}

	@PatchMapping("/api/events/{id}")
	public ResponseEntity<?> edit(@PathVariable String id, @RequestBody TitleChange change) {
		AccountUser user = MeController.currentUser();
		UUID eventId = parse(id);
		if (eventId == null || !owned(eventId, user)) {
			return missing();
		}
		String title = change.title() == null ? "" : change.title().trim();
		if (title.isEmpty() || title.length() > 300) {
			return ResponseEntity.badRequest().body(new ApiError("Title is required"));
		}
		jdbc.update("update events set title = ?, updated_at = now() where id = ? and user_id = ?",
				title, eventId, user.id());
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

	private EventView findOwned(String id, AccountUser user) {
		UUID eventId = parse(id);
		if (eventId == null) {
			return null;
		}
		return jdbc.query(
				"select id, title, review_status from events where id = ? and user_id = ?",
				(rs, row) -> new EventView(
						rs.getObject("id", UUID.class),
						rs.getString("title"),
						rs.getString("review_status")),
				eventId,
				user.id())
				.stream()
				.findFirst()
				.orElse(null);
	}

	private boolean owned(UUID eventId, AccountUser user) {
		Integer count = jdbc.queryForObject(
				"select count(*) from events where id = ? and user_id = ?",
				Integer.class,
				eventId,
				user.id());
		return count != null && count > 0;
	}

	private static UUID parse(String id) {
		try {
			return UUID.fromString(id);
		} catch (IllegalArgumentException exception) {
			return null;
		}
	}

	private static ResponseEntity<ApiError> missing() {
		return ResponseEntity.status(404).body(new ApiError("Not found"));
	}

	public record TitleChange(String title) {
	}

	public record EventView(UUID id, String title, String reviewStatus) {
	}
}
