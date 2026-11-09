package io.github.evan0x.syllacal.web;

import com.jayway.jsonpath.JsonPath;
import io.github.evan0x.syllacal.PostgresTestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.sql.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainersConfiguration.class)
class AuthAccessTest {

	private static final String INVITE = "test-invite-code";
	private static final String PASSWORD = "password12";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	private Cookie csrfCookie;

	@BeforeEach
	void loadCsrfCookie() throws Exception {
		MvcResult result = mockMvc.perform(get("/api/me")).andReturn();
		csrfCookie = result.getResponse().getCookie("XSRF-TOKEN");
		assertThat(csrfCookie).isNotNull();
		assertThat(csrfCookie.isHttpOnly()).isFalse();
		assertThat(csrfCookie.getSecure()).isTrue();
		assertThat(csrfCookie.getAttribute("SameSite")).isEqualTo("Lax");
	}

	@Test
	void unauthenticatedCallsAreRejected() throws Exception {
		mockMvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/events/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
		send(delete("/api/me"), null, null, ip()).andExpect(status().isUnauthorized());
		send(post("/api/auth/logout"), null, null, ip()).andExpect(status().isUnauthorized());
	}

	@Test
	void writeWithoutCsrfTokenIsForbidden() throws Exception {
		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(loginJson("person@school.edu", PASSWORD)))
				.andExpect(status().isForbidden());
	}

	@Test
	void registrationRejectsAMissingOrWrongInviteCode() throws Exception {
		String missing = send(post("/api/auth/register"),
				registerJson("one-" + UUID.randomUUID() + "@school.edu", PASSWORD, null), null, ip())
				.andExpect(status().isBadRequest())
				.andReturn()
				.getResponse()
				.getContentAsString();
		String wrong = send(post("/api/auth/register"),
				registerJson("two-" + UUID.randomUUID() + "@school.edu", PASSWORD, "wrong-invite-code"), null, ip())
				.andExpect(status().isBadRequest())
				.andReturn()
				.getResponse()
				.getContentAsString();
		assertThat(missing).contains("Registration is closed");
		assertThat(wrong).contains("Registration is closed");
		assertThat(wrong).doesNotContain("wrong-invite-code").doesNotContain(INVITE);
	}

	@Test
	void duplicateEmailInAnotherCaseIsRejectedWithAGenericMessage() throws Exception {
		String local = UUID.randomUUID().toString();
		MvcResult created = send(post("/api/auth/register"),
				registerJson("  " + local + "@School.edu  ", PASSWORD, INVITE), null, ip())
				.andExpect(status().isCreated())
				.andReturn();
		String body = created.getResponse().getContentAsString();
		String stored = jdbc.queryForObject("select email from users where email = ?", String.class, local + "@school.edu");
		String hash = jdbc.queryForObject("select password_hash from users where email = ?", String.class, local + "@school.edu");
		assertThat(stored).isEqualTo(local + "@school.edu");
		assertThat(body).doesNotContain(hash);
		String duplicate = send(post("/api/auth/register"),
				registerJson(local + "@school.edu", PASSWORD, INVITE), null, ip())
				.andExpect(status().isBadRequest())
				.andReturn()
				.getResponse()
				.getContentAsString();
		assertThat(duplicate).isEqualTo("{\"message\":\"Could not create an account\"}");
		assertThat(duplicate).doesNotContain(hash).doesNotContain(local);
	}

	@Test
	void wrongPasswordAndUnknownEmailLookTheSame() throws Exception {
		String email = "known-" + UUID.randomUUID() + "@school.edu";
		send(post("/api/auth/register"), registerJson(email, PASSWORD, INVITE), null, ip())
				.andExpect(status().isCreated());
		MvcResult unknown = send(post("/api/auth/login"),
				loginJson("missing-" + UUID.randomUUID() + "@school.edu", PASSWORD), null, ip())
				.andExpect(status().isUnauthorized())
				.andReturn();
		MvcResult wrong = send(post("/api/auth/login"),
				loginJson(email, "not-the-password"), null, ip())
				.andExpect(status().isUnauthorized())
				.andReturn();
		assertThat(unknown.getResponse().getContentAsString())
				.isEqualTo(wrong.getResponse().getContentAsString())
				.isEqualTo("{\"message\":\"Invalid email or password\"}");
	}

	@Test
	void sixthFailedLoginIsRateLimited() throws Exception {
		String email = "locked-" + UUID.randomUUID() + "@school.edu";
		String address = ip();
		for (int attempt = 0; attempt < 5; attempt++) {
			send(post("/api/auth/login"), loginJson(email, "not-the-password"), null, address)
					.andExpect(status().isUnauthorized());
		}
		send(post("/api/auth/login"), loginJson(email, "not-the-password"), null, address)
				.andExpect(status().isTooManyRequests());
	}

	@Test
	void anotherUserCannotReadEditConfirmOrDeleteTheEvent() throws Exception {
		String ownerEmail = "owner-" + UUID.randomUUID() + "@school.edu";
		String otherEmail = "other-" + UUID.randomUUID() + "@school.edu";
		UUID ownerId = register(ownerEmail);
		register(otherEmail);
		SignedIn owner = login(ownerEmail);
		SignedIn other = login(otherEmail);
		UUID eventId = insertEvent(ownerId);

		send(get("/api/events/" + eventId), null, owner, ip()).andExpect(status().isOk());
		send(get("/api/events/" + eventId), null, other, ip()).andExpect(status().isNotFound());
		send(patch("/api/events/" + eventId), "{\"title\":\"Renamed\"}", other, ip()).andExpect(status().isNotFound());
		send(post("/api/events/" + eventId + "/confirm"), null, other, ip()).andExpect(status().isNotFound());
		send(delete("/api/events/" + eventId), null, other, ip()).andExpect(status().isNotFound());
		send(get("/api/events/" + eventId), null, owner, ip()).andExpect(status().isOk());
	}

	@Test
	void deletingTheAccountRemovesCoursesSyllabiAndEvents() throws Exception {
		String email = "gone-" + UUID.randomUUID() + "@school.edu";
		UUID userId = register(email);
		SignedIn user = login(email);
		insertEvent(userId);
		String hash = jdbc.queryForObject("select password_hash from users where id = ?", String.class, userId);

		MvcResult me = send(get("/api/me"), null, user, ip()).andExpect(status().isOk()).andReturn();
		assertThat(me.getResponse().getContentAsString()).doesNotContain(hash).doesNotContain("password");
		send(delete("/api/me"), null, user, ip()).andExpect(status().isNoContent());

		assertThat(count("users", "id", userId)).isZero();
		assertThat(count("courses", "user_id", userId)).isZero();
		assertThat(count("syllabi", "user_id", userId)).isZero();
		assertThat(count("events", "user_id", userId)).isZero();
	}

	private UUID register(String email) throws Exception {
		MvcResult result = send(post("/api/auth/register"), registerJson(email, PASSWORD, INVITE), null, ip())
				.andExpect(status().isCreated())
				.andReturn();
		return UUID.fromString(JsonPath.read(result.getResponse().getContentAsString(), "$.id"));
	}

	private SignedIn login(String email) throws Exception {
		MvcResult result = send(post("/api/auth/login"), loginJson(email, PASSWORD), null, ip())
				.andExpect(status().isOk())
				.andReturn();
		MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
		Cookie csrf = result.getResponse().getCookie("XSRF-TOKEN");
		if (csrf == null) {
			csrf = csrfCookie;
		}
		assertThat(session).isNotNull();
		assertThat(csrf).isNotNull();
		return new SignedIn(session, csrf);
	}

	private UUID insertEvent(UUID userId) {
		UUID courseId = UUID.randomUUID();
		UUID syllabusId = UUID.randomUUID();
		UUID eventId = UUID.randomUUID();
		jdbc.update("insert into courses (id, user_id, name) values (?, ?, ?)", courseId, userId, "MATH 125");
		jdbc.update("""
				insert into syllabi (id, user_id, course_id, file_sha256, model_name, prompt_version, status)
				values (?, ?, ?, ?, ?, ?, ?)
				""", syllabusId, userId, courseId, "a".repeat(64), "gemini-3.5-flash-lite", "v1", "READY");
		jdbc.update("""
				insert into events (id, user_id, course_id, syllabus_id, title, type, event_date)
				values (?, ?, ?, ?, ?, ?, ?)
				""", eventId, userId, courseId, syllabusId, "Final", "EXAM", Date.valueOf("2026-12-15"));
		return eventId;
	}

	private ResultActions send(MockHttpServletRequestBuilder request, String json, SignedIn who, String address)
			throws Exception {
		Cookie csrf = who == null ? csrfCookie : who.csrf();
		request.cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
		if (json != null) {
			request.contentType(MediaType.APPLICATION_JSON).content(json);
		}
		if (who != null) {
			request.session(who.session());
		}
		request.with(servletRequest -> {
			servletRequest.setRemoteAddr(address);
			return servletRequest;
		});
		return mockMvc.perform(request);
	}

	private int count(String table, String column, UUID userId) {
		Integer count = jdbc.queryForObject(
				"select count(*) from " + table + " where " + column + " = ?",
				Integer.class,
				userId);
		return count == null ? 0 : count;
	}

	private static String ip() {
		UUID id = UUID.randomUUID();
		int first = (id.hashCode() >>> 16) & 0xff;
		int second = (id.hashCode() >>> 8) & 0xff;
		int third = id.hashCode() & 0xff;
		return "10." + (first % 250) + "." + (second % 250) + "." + (third % 250);
	}

	private static String registerJson(String email, String password, String inviteCode) {
		return "{\"email\":" + json(email) + ",\"password\":" + json(password) + ",\"inviteCode\":" + json(inviteCode) + "}";
	}

	private static String loginJson(String email, String password) {
		return "{\"email\":" + json(email) + ",\"password\":" + json(password) + "}";
	}

	private static String json(String value) {
		return value == null ? "null" : "\"" + value + "\"";
	}

	private record SignedIn(MockHttpSession session, Cookie csrf) {
	}
}
