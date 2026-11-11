package io.github.evan0x.syllacal.web;

import com.jayway.jsonpath.JsonPath;
import io.github.evan0x.syllacal.PostgresTestcontainersConfiguration;
import io.github.evan0x.syllacal.mail.VerificationCodeMail;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainersConfiguration.class)
class RegistrationMailTest {

	private static final String PASSWORD = "password12";

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private VerificationCodeMail verificationCodeMail;

	private Cookie csrfCookie;

	@BeforeEach
	void loadCsrfCookie() throws Exception {
		MvcResult result = mockMvc.perform(get("/api/me")).andReturn();
		csrfCookie = result.getResponse().getCookie("XSRF-TOKEN");
	}

	@Test
	void successfulRegistrationSendsTheVerificationCode() throws Exception {
		String email = "mail-" + UUID.randomUUID() + "@school.edu";
		MvcResult created = register(email, PASSWORD);
		assertThat(created.getResponse().getStatus()).isEqualTo(201);
		String code = JsonPath.read(created.getResponse().getContentAsString(), "$.verificationCode");

		verify(verificationCodeMail).send(email, code);
		assertThat(created.getRequest().getSession(false)).isNull();
		assertThat(code).isNotEqualTo(PASSWORD);
		assertThat(created.getResponse().getContentAsString()).doesNotContain(PASSWORD);
	}

	@Test
	void failedRegistrationDoesNotSendMail() throws Exception {
		String email = "fail-" + UUID.randomUUID() + "@school.edu";
		assertThat(register(email, "short").getResponse().getStatus()).isEqualTo(400);
		assertThat(register("not-an-email", PASSWORD).getResponse().getStatus()).isEqualTo(400);
		verify(verificationCodeMail, never()).send(anyString(), anyString());

		assertThat(register(email, PASSWORD).getResponse().getStatus()).isEqualTo(201);
		clearInvocations(verificationCodeMail);
		assertThat(register(email, PASSWORD).getResponse().getStatus()).isEqualTo(400);
		verify(verificationCodeMail, never()).send(anyString(), anyString());
	}

	private MvcResult register(String email, String password) throws Exception {
		return mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.cookie(csrfCookie)
						.header("X-XSRF-TOKEN", csrfCookie.getValue())
						.content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
				.andReturn();
	}
}
