package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.PostgresTestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestcontainersConfiguration.class)
class SessionCookieTest {

	private static final String PASSWORD = "password12";

	@LocalServerPort
	private int port;

	@Autowired
	private org.springframework.core.env.Environment environment;

	@Test
	void loginSetsAnHttpOnlySecureSameSiteSessionCookie() throws Exception {
		assertThat(environment.getProperty("server.servlet.session.cookie.http-only")).isEqualTo("true");
		assertThat(environment.getProperty("server.servlet.session.cookie.secure")).isEqualTo("true");
		assertThat(environment.getProperty("server.servlet.session.cookie.same-site")).isEqualTo("lax");

		HttpClient client = HttpClient.newHttpClient();
		HttpResponse<String> unauthenticated = client.send(request("GET", "/api/me", null, null), bodyHandler());
		String csrf = csrfValue(unauthenticated);
		String email = "cookie-" + UUID.randomUUID() + "@school.edu";

		HttpResponse<String> registered = client.send(
				request("POST", "/api/auth/register", csrf, registerJson(email)),
				bodyHandler());
		assertThat(registered.statusCode()).isEqualTo(201);

		HttpResponse<String> loggedIn = client.send(
				request("POST", "/api/auth/login", csrf, loginJson(email)),
				bodyHandler());
		assertThat(loggedIn.statusCode()).isEqualTo(200);

		String session = loggedIn.headers().allValues("set-cookie").stream()
				.filter(header -> header.startsWith("JSESSIONID="))
				.findFirst()
				.orElse("");
		assertThat(session).contains("HttpOnly");
		assertThat(session).contains("Secure");
		assertThat(session.toLowerCase()).contains("samesite=lax");
		assertThat(loggedIn.body()).doesNotContain("password");
	}

	private HttpRequest request(String method, String path, String csrf, String json) {
		HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
		if (json == null) {
			builder.GET();
		} else {
			builder.method(method, HttpRequest.BodyPublishers.ofString(json))
					.header("Content-Type", "application/json");
		}
		if (csrf != null) {
			builder.header("Cookie", "XSRF-TOKEN=" + csrf);
			builder.header("X-XSRF-TOKEN", csrf);
		}
		return builder.build();
	}

	private static HttpResponse.BodyHandler<String> bodyHandler() {
		return HttpResponse.BodyHandlers.ofString();
	}

	private static String csrfValue(HttpResponse<String> response) {
		List<String> cookies = response.headers().allValues("set-cookie");
		return cookies.stream()
				.filter(header -> header.startsWith("XSRF-TOKEN="))
				.map(header -> header.substring("XSRF-TOKEN=".length(), header.indexOf(';')))
				.findFirst()
				.orElseThrow();
	}

	private static String registerJson(String email) {
		return "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"inviteCode\":\"test-invite-code\"}";
	}

	private static String loginJson(String email) {
		return "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
	}
}
