package io.github.evan0x.syllacal.db;

import io.github.evan0x.syllacal.PostgresTestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Time;
import java.sql.Types;
import java.time.LocalTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(PostgresTestcontainersConfiguration.class)
class DatabaseSchemaTest {

	private static final String SHA = "a".repeat(64);

	@Autowired
	private JdbcTemplate jdbc;

	@Test
	void migrationAppliesToAnEmptyDatabase() {
		Integer applied = jdbc.queryForObject(
				"select count(*) from flyway_schema_history where version = '1' and success",
				Integer.class);
		assertThat(applied).isEqualTo(1);
		assertThat(jdbc.queryForList(
				"select table_name from information_schema.tables where table_schema = 'public'",
				String.class))
				.contains("users", "courses", "syllabi", "events");
	}

	@Test
	void insertingAValidUserCourseSyllabusAndEventWorks() {
		UUID userId = insertUser("student@school.edu");
		UUID courseId = insertCourse(userId, "MATH 125");
		UUID syllabusId = insertSyllabus(userId, courseId);
		UUID eventId = insertEvent(userId, courseId, syllabusId, "Midterm", "EXAM",
				LocalTime.of(22, 30), LocalTime.of(23, 30), new BigDecimal("25.00"), "HIGH",
				"Thursday, October 15");

		assertThat(count("users", userId)).isEqualTo(1);
		assertThat(count("courses", userId)).isEqualTo(1);
		assertThat(count("syllabi", userId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select title from events where id = ?", String.class, eventId))
				.isEqualTo("Midterm");
	}

	@Test
	void emailUniquenessIgnoresCase() {
		insertUser("A@x.com");

		assertThatThrownBy(() -> insertUser("a@x.com"))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void endTimeEarlierThanStartTimeIsRejected() {
		UUID userId = insertUser("early@school.edu");
		UUID courseId = insertCourse(userId, "HIST 125");

		assertThatThrownBy(() -> insertEvent(userId, courseId, null, "Quiz", "QUIZ",
				LocalTime.of(10, 0), LocalTime.of(9, 0), null, "HIGH", null))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void endTimeWithoutStartTimeIsRejected() {
		UUID userId = insertUser("open@school.edu");
		UUID courseId = insertCourse(userId, "HIST 125");

		assertThatThrownBy(() -> insertEvent(userId, courseId, null, "Quiz", "QUIZ",
				null, LocalTime.of(9, 0), null, "HIGH", null))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void weightAbove100IsRejected() {
		UUID userId = insertUser("weight@school.edu");
		UUID courseId = insertCourse(userId, "MATH 114");

		assertThatThrownBy(() -> insertEvent(userId, courseId, null, "Final", "EXAM",
				null, null, new BigDecimal("150"), "HIGH", null))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void unknownTypeIsRejected() {
		UUID userId = insertUser("type@school.edu");
		UUID courseId = insertCourse(userId, "MATH 114");

		assertThatThrownBy(() -> insertEvent(userId, courseId, null, "Final", "BOGUS",
				null, null, null, "HIGH", null))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void unknownConfidenceIsRejected() {
		UUID userId = insertUser("confidence@school.edu");
		UUID courseId = insertCourse(userId, "MATH 114");

		assertThatThrownBy(() -> insertEvent(userId, courseId, null, "Final", "EXAM",
				null, null, null, "MAYBE", null))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void sourceQuoteOf500CharactersIsAcceptedAnd501IsRejected() {
		UUID userId = insertUser("quote@school.edu");
		UUID courseId = insertCourse(userId, "MATH 125");
		String accepted = "q".repeat(500);
		UUID eventId = insertEvent(userId, courseId, null, "Essay", "ASSIGNMENT",
				null, null, null, "MEDIUM", accepted);

		assertThat(jdbc.queryForObject(
				"select char_length(source_quote) from events where id = ?", Integer.class, eventId))
				.isEqualTo(500);
		assertThatThrownBy(() -> insertEvent(userId, courseId, null, "Essay 2", "ASSIGNMENT",
				null, null, null, "MEDIUM", "q".repeat(501)))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void eventForAnotherUsersCourseIsRejected() {
		UUID ownerId = insertUser("owner@school.edu");
		UUID otherId = insertUser("other@school.edu");
		UUID courseId = insertCourse(ownerId, "MATH 125");

		assertThatThrownBy(() -> insertEvent(otherId, courseId, null, "Midterm", "EXAM",
				null, null, null, "HIGH", null))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void deletingAUserDeletesCoursesSyllabiAndEvents() {
		UUID userId = insertUser("gone@school.edu");
		UUID courseId = insertCourse(userId, "MATH 125");
		UUID syllabusId = insertSyllabus(userId, courseId);
		insertEvent(userId, courseId, syllabusId, "Final", "EXAM",
				null, null, null, "HIGH", null);

		jdbc.update("delete from users where id = ?", userId);

		assertThat(count("courses", userId)).isZero();
		assertThat(count("syllabi", userId)).isZero();
		assertThat(count("events", userId)).isZero();
	}

	@Test
	void deletingASyllabusKeepsEventsAndClearsSyllabusId() {
		UUID userId = insertUser("keep@school.edu");
		UUID courseId = insertCourse(userId, "HIST 125");
		UUID syllabusId = insertSyllabus(userId, courseId);
		UUID eventId = insertEvent(userId, courseId, syllabusId, "Map quiz", "QUIZ",
				null, null, null, "HIGH", null);

		jdbc.update("delete from syllabi where id = ?", syllabusId);

		assertThat(jdbc.queryForObject("select count(*) from events where id = ?", Integer.class, eventId))
				.isEqualTo(1);
		assertThat(jdbc.queryForObject("select syllabus_id from events where id = ?", UUID.class, eventId))
				.isNull();
	}

	private UUID insertUser(String email) {
		UUID id = UUID.randomUUID();
		jdbc.update("insert into users (id, email, password_hash) values (?, ?, ?)", id, email, "hash");
		return id;
	}

	private UUID insertCourse(UUID userId, String name) {
		UUID id = UUID.randomUUID();
		jdbc.update("insert into courses (id, user_id, name) values (?, ?, ?)", id, userId, name);
		return id;
	}

	private UUID insertSyllabus(UUID userId, UUID courseId) {
		UUID id = UUID.randomUUID();
		jdbc.update("""
				insert into syllabi (id, user_id, course_id, file_sha256, model_name, prompt_version, status)
				values (?, ?, ?, ?, ?, ?, ?)
				""", id, userId, courseId, SHA, "gemini-3.5-flash-lite", "v1", "READY");
		return id;
	}

	private UUID insertEvent(
			UUID userId,
			UUID courseId,
			UUID syllabusId,
			String title,
			String type,
			LocalTime start,
			LocalTime end,
			BigDecimal weight,
			String confidence,
			String sourceQuote) {
		UUID id = UUID.randomUUID();
		jdbc.update("""
				insert into events (
				    id, user_id, course_id, syllabus_id, title, type, event_date,
				    start_time, end_time, weight_percent, confidence, source_quote)
				values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				""", (PreparedStatement statement) -> {
			statement.setObject(1, id);
			statement.setObject(2, userId);
			statement.setObject(3, courseId);
			if (syllabusId == null) {
				statement.setNull(4, Types.OTHER);
			} else {
				statement.setObject(4, syllabusId);
			}
			statement.setString(5, title);
			statement.setString(6, type);
			statement.setDate(7, Date.valueOf("2026-10-15"));
			if (start == null) {
				statement.setNull(8, Types.TIME);
			} else {
				statement.setTime(8, Time.valueOf(start));
			}
			if (end == null) {
				statement.setNull(9, Types.TIME);
			} else {
				statement.setTime(9, Time.valueOf(end));
			}
			if (weight == null) {
				statement.setNull(10, Types.NUMERIC);
			} else {
				statement.setBigDecimal(10, weight);
			}
			if (confidence == null) {
				statement.setNull(11, Types.VARCHAR);
			} else {
				statement.setString(11, confidence);
			}
			if (sourceQuote == null) {
				statement.setNull(12, Types.VARCHAR);
			} else {
				statement.setString(12, sourceQuote);
			}
		});
		return id;
	}

	private int count(String table, UUID userId) {
		Integer count = jdbc.queryForObject(
				"select count(*) from " + table + " where " + (table.equals("users") ? "id" : "user_id") + " = ?",
				Integer.class,
				userId);
		return count == null ? 0 : count;
	}

}
