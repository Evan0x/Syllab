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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainersConfiguration.class)
class EventCalendarTest {

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
	}

	@Test
	void calendarPageLoadsWithoutAuthentication() throws Exception {
		assertThat(mockMvc.perform(get("/calendar")).andReturn().getResponse().getStatus()).isNotEqualTo(401);
	}

	@Test
	void listingEventsRequiresAuthentication() throws Exception {
		mockMvc.perform(get("/api/events")).andExpect(status().isUnauthorized());
	}

	@Test
	void savingTheSameIdsUpdatesTheRowAndKeepsTheSourceQuote() throws Exception {
		String email = "calendar-" + UUID.randomUUID() + "@school.edu";
		register(email);
		SignedIn user = login(email);
		UUID courseId = UUID.randomUUID();
		UUID eventId = UUID.randomUUID();

		send(put("/api/events"), calendarJson(courseId, eventId, "Quiz 1", "Chapter 3 quiz"), user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(eventId.toString()))
				.andExpect(jsonPath("$[0].reviewStatus").value("CONFIRMED"))
				.andExpect(jsonPath("$[0].sourceQuote").value("Chapter 3 quiz"));

		send(put("/api/events"), calendarJson(courseId, eventId, "Quiz 1 revised", "replaced quote"), user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].title").value("Quiz 1 revised"))
				.andExpect(jsonPath("$[0].sourceQuote").value("Chapter 3 quiz"));

		Integer rows = jdbc.queryForObject("select count(*) from events where id = ?", Integer.class, eventId);
		assertThat(rows).isEqualTo(1);
		assertThat(jdbc.queryForObject("select source_quote from events where id = ?", String.class, eventId))
				.isEqualTo("Chapter 3 quiz");
	}

	@Test
	void patchUpdatesTheDateWithoutChangingTheSourceQuote() throws Exception {
		String email = "patch-" + UUID.randomUUID() + "@school.edu";
		register(email);
		SignedIn user = login(email);
		UUID courseId = UUID.randomUUID();
		UUID eventId = UUID.randomUUID();
		send(put("/api/events"), calendarJson(courseId, eventId, "Midterm", "See week 6"), user)
				.andExpect(status().isOk());

		send(patch("/api/events/" + eventId), """
				{"title":"Midterm moved","type":"EXAM","date":"2026-10-20","time":"09:00","endTime":"10:30","location":"Hall A","weightPercent":25}
				""", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.date").value("2026-10-20"))
				.andExpect(jsonPath("$.title").value("Midterm moved"))
				.andExpect(jsonPath("$.sourceQuote").value("See week 6"))
				.andExpect(jsonPath("$.location").value("Hall A"));
	}

	@Test
	void oneAccountCannotSeeOrChangeAnotherAccountsEvents() throws Exception {
		String ownerEmail = "owner-" + UUID.randomUUID() + "@school.edu";
		String otherEmail = "other-" + UUID.randomUUID() + "@school.edu";
		register(ownerEmail);
		register(otherEmail);
		SignedIn owner = login(ownerEmail);
		SignedIn other = login(otherEmail);
		UUID eventId = UUID.randomUUID();
		send(put("/api/events"), calendarJson(UUID.randomUUID(), eventId, "Final", "Cumulative"), owner)
				.andExpect(status().isOk());

		send(get("/api/events"), null, other).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		send(patch("/api/events/" + eventId), "{\"title\":\"Stolen\"}", other).andExpect(status().isNotFound());
		send(delete("/api/events/" + eventId), null, other).andExpect(status().isNotFound());
		send(get("/api/events"), null, owner)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].title").value("Final"));
	}

	@Test
	void removingAnEventFromTheSavedSetDeletesThatRow() throws Exception {
		String email = "drop-" + UUID.randomUUID() + "@school.edu";
		register(email);
		SignedIn user = login(email);
		UUID courseId = UUID.randomUUID();
		UUID kept = UUID.randomUUID();
		UUID dropped = UUID.randomUUID();
		String body = """
				{"courseId":"%s","courseName":"BIO 201","termStart":"2026-08-25","termEnd":"2026-12-12","events":[
				{"id":"%s","title":"Lab","type":"ASSIGNMENT","date":"2026-09-02","sourceQuote":"Lab 1"},
				{"id":"%s","title":"Exam","type":"EXAM","date":"2026-10-01","sourceQuote":"Exam 1"}]}
				""".formatted(courseId, kept, dropped);
		send(put("/api/events"), body, user).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));

		send(put("/api/events"), calendarJson(courseId, kept, "Lab", "Lab 1"), user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].id").value(kept.toString()));
		Integer droppedRows = jdbc.queryForObject("select count(*) from events where id = ?", Integer.class, dropped);
		assertThat(droppedRows).isZero();
	}

	private void register(String email) throws Exception {
		MvcResult result = send(post("/api/auth/register"),
				"{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}", null)
				.andExpect(status().isCreated())
				.andReturn();
		String code = JsonPath.read(result.getResponse().getContentAsString(), "$.verificationCode");
		send(post("/api/auth/verify-email"),
				"{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}", null)
				.andExpect(status().isNoContent());
	}

	private SignedIn login(String email) throws Exception {
		MvcResult result = send(post("/api/auth/login"),
				"{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}", null)
				.andExpect(status().isOk())
				.andReturn();
		MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
		Cookie csrf = result.getResponse().getCookie("XSRF-TOKEN");
		if (csrf == null) {
			csrf = csrfCookie;
		}
		assertThat(session).isNotNull();
		return new SignedIn(session, csrf);
	}

	private static String calendarJson(UUID courseId, UUID eventId, String title, String quote) {
		return """
				{"courseId":"%s","courseName":"PSYC 101","termStart":"2026-08-25","termEnd":"2026-12-12","events":[
				{"id":"%s","title":"%s","type":"QUIZ","date":"2026-09-14","time":"14:00","weightPercent":10,"confidence":"HIGH","sourceQuote":"%s"}]}
				""".formatted(courseId, eventId, title, quote);
	}

	private ResultActions send(MockHttpServletRequestBuilder request, String json, SignedIn who) throws Exception {
		Cookie csrf = who == null ? csrfCookie : who.csrf();
		request.cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
		if (json != null) {
			request.contentType(MediaType.APPLICATION_JSON).content(json);
		}
		if (who != null) {
			request.session(who.session());
		}
		return mockMvc.perform(request);
	}

	private static MockHttpServletRequestBuilder post(String path) {
		return org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path);
	}

	private record SignedIn(MockHttpSession session, Cookie csrf) {
	}
}
