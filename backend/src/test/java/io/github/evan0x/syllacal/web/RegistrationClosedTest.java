package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.PostgresTestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainersConfiguration.class)
@TestPropertySource(properties = "syllacal.invite-code=")
class RegistrationClosedTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void registrationIsClosedWhenNoInviteCodeIsConfigured() throws Exception {
		MvcResult csrf = mockMvc.perform(get("/api/me")).andReturn();
		Cookie cookie = csrf.getResponse().getCookie("XSRF-TOKEN");
		assertThat(cookie).isNotNull();
		String email = "closed-" + UUID.randomUUID() + "@school.edu";
		mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.cookie(cookie)
						.header("X-XSRF-TOKEN", cookie.getValue())
						.content("{\"email\":\"" + email + "\",\"password\":\"password12\",\"inviteCode\":\"test-invite-code\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(result -> assertThat(result.getResponse().getContentAsString())
						.contains("Registration is closed")
						.doesNotContain("test-invite-code"));
	}
}
