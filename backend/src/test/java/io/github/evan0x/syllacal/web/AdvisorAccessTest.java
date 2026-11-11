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
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainersConfiguration.class)
class AdvisorAccessTest {

	private static final String PASSWORD = "password12";

	@Autowired
	private MockMvc mockMvc;

	private Cookie csrfCookie;

	@BeforeEach
	void loadCsrfCookie() throws Exception {
		MvcResult result = mockMvc.perform(get("/api/me")).andReturn();
		csrfCookie = result.getResponse().getCookie("XSRF-TOKEN");
		assertThat(csrfCookie).isNotNull();
	}

	@Test
	void advisorPageLoadsWithoutAuthentication() throws Exception {
		assertThat(mockMvc.perform(get("/advisor")).andReturn().getResponse().getStatus()).isNotEqualTo(401);
	}

	@Test
	void advisorApiRequiresAuthentication() throws Exception {
		mockMvc.perform(get("/api/advisor")).andExpect(status().isUnauthorized());
	}

	@Test
	void oneAccountCannotReadAnotherAccountsCourses() throws Exception {
		String ownerEmail = "advisor-owner-" + UUID.randomUUID() + "@school.edu";
		String otherEmail = "advisor-other-" + UUID.randomUUID() + "@school.edu";
		register(ownerEmail);
		register(otherEmail);
		SignedIn owner = login(ownerEmail);
		SignedIn other = login(otherEmail);
		UUID courseId = UUID.randomUUID();
		UUID weighted = UUID.randomUUID();
		UUID unweighted = UUID.randomUUID();
		String body = """
				{"courseId":"%s","courseName":"HIST 210","termStart":"2026-08-25","termEnd":"2026-12-12","events":[
				{"id":"%s","title":"Midterm","type":"EXAM","date":"2026-11-14","weightPercent":20,"sourceQuote":"Midterm is 20 percent"},
				{"id":"%s","title":"Reading","type":"ASSIGNMENT","date":"2026-11-12","sourceQuote":"Read chapter 2"}]}
				""".formatted(courseId, weighted, unweighted);
		send(put("/api/events"), body, owner).andExpect(status().isOk());

		send(get("/api/advisor?today=2026-11-10"), null, owner)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.courses[0].name").value("HIST 210"))
				.andExpect(jsonPath("$.courses[0].exams").value(1))
				.andExpect(jsonPath("$.courses[0].assignments").value(1))
				.andExpect(jsonPath("$.courses[0].weightsMissing").value(1))
				.andExpect(jsonPath("$.courses[0].deadlines[1].title").value("Midterm"))
				.andExpect(jsonPath("$.courses[0].deadlines[1].quote").value("Midterm is 20 percent"))
				.andExpect(jsonPath("$.nextExam.title").value("Midterm"))
				.andExpect(jsonPath("$.preparation.calendarDays").value(5));

		send(get("/api/advisor?today=2026-11-10"), null, other)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.courses.length()").value(0));

		send(post("/api/advisor/ask"), """
				{"today":"2026-11-10","courseIds":["%s"],"question":"What is due?"}
				""".formatted(courseId), other).andExpect(status().isNotFound());

		send(post("/api/advisor/ask"), """
				{"today":"2026-11-10","question":"  "}
				""", owner).andExpect(status().isBadRequest());
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

	private record SignedIn(MockHttpSession session, Cookie csrf) {
	}
}
