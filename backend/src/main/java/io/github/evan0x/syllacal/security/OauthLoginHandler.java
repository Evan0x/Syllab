package io.github.evan0x.syllacal.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Optional;

@Component
public class OauthLoginHandler implements AuthenticationSuccessHandler, AuthenticationFailureHandler {

	static final String ERROR_REDIRECT = "/?oauthError=email";

	private final VerifiedOauthAccounts accounts;
	private final SecurityContextHolderStrategy securityContextHolderStrategy =
			SecurityContextHolder.getContextHolderStrategy();
	private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

	public OauthLoginHandler(VerifiedOauthAccounts accounts) {
		this.accounts = accounts;
	}

	@Override
	public void onAuthenticationSuccess(
			HttpServletRequest request,
			HttpServletResponse response,
			Authentication authentication) throws IOException {
		Optional<String> email = verifiedEmail(authentication);
		Optional<AccountUser> account = email.flatMap(accounts::link);
		if (account.isEmpty()) {
			reject(request, response);
			return;
		}
		AccountUser user = account.get().withoutSecret();
		Authentication stored = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
		SecurityContext context = securityContextHolderStrategy.createEmptyContext();
		context.setAuthentication(stored);
		securityContextHolderStrategy.setContext(context);
		securityContextRepository.saveContext(context, request, response);
		response.sendRedirect("/");
	}

	@Override
	public void onAuthenticationFailure(
			HttpServletRequest request,
			HttpServletResponse response,
			org.springframework.security.core.AuthenticationException exception) throws IOException {
		reject(request, response);
	}

	private void reject(HttpServletRequest request, HttpServletResponse response) throws IOException {
		securityContextHolderStrategy.clearContext();
		HttpSession session = request.getSession(false);
		if (session != null) {
			session.invalidate();
		}
		response.sendRedirect(ERROR_REDIRECT);
	}

	private static Optional<String> verifiedEmail(Authentication authentication) {
		if (!(authentication instanceof OAuth2AuthenticationToken token)) {
			return Optional.empty();
		}
		if (token.getPrincipal() instanceof OidcUser oidc) {
			if (!Boolean.TRUE.equals(oidc.getEmailVerified())) {
				return Optional.empty();
			}
			return Optional.ofNullable(oidc.getEmail());
		}
		if (GitHubVerifiedEmailUserService.REGISTRATION_ID.equals(token.getAuthorizedClientRegistrationId())
				&& token.getPrincipal() instanceof OAuth2User user
				&& user.getAttribute("email") instanceof String email) {
			return Optional.of(email);
		}
		return Optional.empty();
	}
}
