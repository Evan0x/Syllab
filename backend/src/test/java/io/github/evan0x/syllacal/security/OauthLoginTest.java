package io.github.evan0x.syllacal.security;

import io.github.evan0x.syllacal.PostgresTestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainersConfiguration.class)
class OauthLoginTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private OauthLoginHandler oauthLogin;

	@Autowired
	private AccountRepository accounts;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Test
	void providersRedirectWithoutPuttingTheClientSecretInTheUrl() throws Exception {
		mockMvc.perform(get("/oauth2/authorization/google"))
				.andExpect(status().isFound())
				.andExpect(header().string("Location", containsString("accounts.google.com")))
				.andExpect(header().string("Location", containsString("client_id=test-google-client")))
				.andExpect(header().string("Location", not(containsString("test-google-secret"))));
		mockMvc.perform(get("/oauth2/authorization/github"))
				.andExpect(status().isFound())
				.andExpect(header().string("Location", containsString("github.com/login/oauth/authorize")))
				.andExpect(header().string("Location", containsString("client_id=test-github-client")))
				.andExpect(header().string("Location", not(containsString("test-github-secret"))));
		mockMvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
	}

	@Test
	void verifiedGoogleEmailSignsInWithoutACodeAndLinksAnExistingPasswordAccount() throws Exception {
		String email = "same-" + UUID.randomUUID() + "@school.edu";
		String hash = passwordEncoder.encode("password12");
		assertThat(accounts.insert(UUID.randomUUID(), email, hash)).isTrue();

		SignIn signedIn = signIn(google(email, true));

		assertThat(signedIn.response().getRedirectedUrl()).isEqualTo("/");
		AccountUser user = signedInUser(signedIn);
		assertThat(user.email()).isEqualTo(email);
		assertThat(user.emailVerified()).isTrue();
		assertThat(user.getPassword()).isNull();
		assertThat(jdbc.queryForObject("select count(*) from users where email = ?", Integer.class, email)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select password_hash from users where email = ?", String.class, email)).isEqualTo(hash);
		assertThat(jdbc.queryForObject("select email_verified from users where email = ?", Boolean.class, email)).isTrue();
		assertThat(jdbc.queryForObject(
				"select count(*) from email_verification_codes where user_id = (select id from users where email = ?)",
				Integer.class,
				email)).isZero();
	}

	@Test
	void unverifiedGoogleEmailIsRefused() throws Exception {
		String email = "unverified-" + UUID.randomUUID() + "@school.edu";
		SignIn signedIn = signIn(google(email, false));

		assertThat(signedIn.response().getRedirectedUrl()).isEqualTo(OauthLoginHandler.ERROR_REDIRECT);
		assertThat(jdbc.queryForObject("select count(*) from users where email = ?", Integer.class, email)).isZero();
	}

	@Test
	void verifiedGitHubEmailCreatesAnAccountWithoutAPassword() throws Exception {
		String email = "github-" + UUID.randomUUID() + "@school.edu";
		SignIn signedIn = signIn(github(email));

		assertThat(signedIn.response().getRedirectedUrl()).isEqualTo("/");
		assertThat(signedInUser(signedIn).email()).isEqualTo(email);
		assertThat(jdbc.queryForObject("select password_hash from users where email = ?", String.class, email)).isNull();
		assertThat(jdbc.queryForObject("select email_verified from users where email = ?", Boolean.class, email)).isTrue();
		assertThat(jdbc.queryForObject(
				"select count(*) from email_verification_codes where user_id = (select id from users where email = ?)",
				Integer.class,
				email)).isZero();

		MvcResult csrf = mockMvc.perform(get("/api/me")).andReturn();
		Cookie cookie = csrf.getResponse().getCookie("XSRF-TOKEN");
		assertThat(cookie).isNotNull();
		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.cookie(cookie)
						.header("X-XSRF-TOKEN", cookie.getValue())
						.content("{\"email\":\"" + email + "\",\"password\":\"password12\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void gitHubWithoutAnEmailIsRefused() throws Exception {
		String missing = "missing-" + UUID.randomUUID() + "@school.edu";
		DefaultOAuth2User user = new DefaultOAuth2User(
				List.of(new SimpleGrantedAuthority("OAUTH2_USER")),
				Map.of("id", 1),
				"id");
		SignIn signedIn = signIn(new OAuth2AuthenticationToken(user, user.getAuthorities(), "github"));

		assertThat(signedIn.response().getRedirectedUrl()).isEqualTo(OauthLoginHandler.ERROR_REDIRECT);
		assertThat(jdbc.queryForObject("select count(*) from users where email = ?", Integer.class, missing)).isZero();
	}

	private SignIn signIn(OAuth2AuthenticationToken authentication) throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest();
		MockHttpServletResponse response = new MockHttpServletResponse();
		oauthLogin.onAuthenticationSuccess(request, response, authentication);
		return new SignIn(request, response);
	}

	private static AccountUser signedInUser(SignIn signedIn) {
		SecurityContext context = (SecurityContext) signedIn.request().getSession(false)
				.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
		return (AccountUser) context.getAuthentication().getPrincipal();
	}

	private record SignIn(MockHttpServletRequest request, MockHttpServletResponse response) {
	}

	private static OAuth2AuthenticationToken google(String email, boolean verified) {
		OidcIdToken idToken = new OidcIdToken(
				"google-id-token",
				Instant.now(),
				Instant.now().plusSeconds(60),
				Map.of("sub", "google-user", "email", email, "email_verified", verified));
		DefaultOidcUser user = new DefaultOidcUser(List.of(new SimpleGrantedAuthority("OIDC_USER")), idToken);
		return new OAuth2AuthenticationToken(user, user.getAuthorities(), "google");
	}

	private static OAuth2AuthenticationToken github(String email) {
		DefaultOAuth2User user = new DefaultOAuth2User(
				List.of(new SimpleGrantedAuthority("OAUTH2_USER")),
				Map.of("id", 7, "email", email),
				"id");
		return new OAuth2AuthenticationToken(user, user.getAuthorities(), "github");
	}
}
