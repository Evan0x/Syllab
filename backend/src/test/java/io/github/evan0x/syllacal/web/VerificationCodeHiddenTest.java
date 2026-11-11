package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.PostgresTestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
@TestPropertySource(properties = "syllacal.return-verification-code=false")
class VerificationCodeHiddenTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Test
	void registrationDoesNotReturnTheVerificationCode() throws Exception {
		MvcResult csrf = mockMvc.perform(get("/api/me")).andReturn();
		Cookie cookie = csrf.getResponse().getCookie("XSRF-TOKEN");
		assertThat(cookie).isNotNull();
		String email = "hidden-" + UUID.randomUUID() + "@school.edu";
		String body = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.cookie(cookie)
						.header("X-XSRF-TOKEN", cookie.getValue())
						.content("{\"email\":\"" + email + "\",\"password\":\"password12\"}"))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getContentAsString();
		String hash = jdbc.queryForObject(
				"select code_hash from email_verification_codes where user_id = (select id from users where email = ?)",
				String.class,
				email);
		assertThat(body).doesNotContain("verificationCode").doesNotContain(hash);
		assertThat(hash).hasSize(64);
	}
}
