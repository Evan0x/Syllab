package io.github.evan0x.syllacal.security;

import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class GitHubVerifiedEmailUserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

	static final String REGISTRATION_ID = "github";
	private static final OAuth2Error EMAIL_NOT_VERIFIED = new OAuth2Error("email_not_verified");

	private final DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
	private final RestClient restClient;

	public GitHubVerifiedEmailUserService(RestClient.Builder restClientBuilder) {
		this.restClient = restClientBuilder.build();
	}

	@Override
	public OAuth2User loadUser(OAuth2UserRequest request) {
		OAuth2User user = delegate.loadUser(request);
		if (!REGISTRATION_ID.equals(request.getClientRegistration().getRegistrationId())) {
			return user;
		}
		String email = verifiedEmail(request.getAccessToken().getTokenValue());
		if (email == null) {
			throw new OAuth2AuthenticationException(EMAIL_NOT_VERIFIED);
		}
		Map<String, Object> attributes = new LinkedHashMap<>(user.getAttributes());
		attributes.put("email", email);
		String nameAttribute = request.getClientRegistration()
				.getProviderDetails()
				.getUserInfoEndpoint()
				.getUserNameAttributeName();
		return new DefaultOAuth2User(user.getAuthorities(), attributes, nameAttribute);
	}

	private String verifiedEmail(String accessToken) {
		GitHubEmail[] emails;
		try {
			emails = restClient.get()
					.uri("https://api.github.com/user/emails")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
					.header(HttpHeaders.ACCEPT, "application/vnd.github+json")
					.retrieve()
					.body(GitHubEmail[].class);
		} catch (RestClientException exception) {
			throw new OAuth2AuthenticationException(EMAIL_NOT_VERIFIED);
		}
		return chooseVerifiedEmail(emails);
	}

	static String chooseVerifiedEmail(GitHubEmail[] emails) {
		if (emails == null) {
			return null;
		}
		String verified = null;
		for (GitHubEmail email : emails) {
			if (email == null || !email.verified() || email.email() == null || email.email().isBlank()) {
				continue;
			}
			if (email.primary()) {
				return email.email();
			}
			if (verified == null) {
				verified = email.email();
			}
		}
		return verified;
	}

	record GitHubEmail(String email, boolean primary, boolean verified) {
	}
}
