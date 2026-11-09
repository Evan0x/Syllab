package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.security.AccountRepository;
import io.github.evan0x.syllacal.security.AccountUser;
import io.github.evan0x.syllacal.security.Emails;
import io.github.evan0x.syllacal.security.InviteCodes;
import io.github.evan0x.syllacal.security.LoginAttemptLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class AuthController {

	static final String INVALID_LOGIN = "Invalid email or password";
	static final String REGISTRATION_CLOSED = "Registration is closed";
	static final String ACCOUNT_NOT_CREATED = "Could not create an account";

	private final AccountRepository accounts;
	private final PasswordEncoder passwordEncoder;
	private final AuthenticationManager authenticationManager;
	private final LoginAttemptLimiter attempts;
	private final SecurityContextHolderStrategy securityContextHolderStrategy =
			SecurityContextHolder.getContextHolderStrategy();
	private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();
	private final String inviteCode;

	public AuthController(
			AccountRepository accounts,
			PasswordEncoder passwordEncoder,
			AuthenticationManager authenticationManager,
			LoginAttemptLimiter attempts,
			@Value("${syllacal.invite-code:}") String inviteCode) {
		this.accounts = accounts;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
		this.attempts = attempts;
		this.inviteCode = inviteCode;
	}

	@PostMapping("/api/auth/register")
	public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
		if (!InviteCodes.matches(inviteCode, request.inviteCode())) {
			return ResponseEntity.badRequest().body(new ApiError(REGISTRATION_CLOSED));
		}
		String email = Emails.normalize(request.email());
		if (email.isEmpty() || !email.contains("@") || email.contains(" ")) {
			return ResponseEntity.badRequest().body(new ApiError("Enter an email address"));
		}
		String password = request.password() == null ? "" : request.password();
		if (password.length() < 10) {
			return ResponseEntity.badRequest().body(new ApiError("Password must be at least 10 characters"));
		}
		if (accounts.findByEmail(email).isPresent()) {
			return ResponseEntity.badRequest().body(new ApiError(ACCOUNT_NOT_CREATED));
		}
		UUID id = UUID.randomUUID();
		if (!accounts.insert(id, email, passwordEncoder.encode(password))) {
			return ResponseEntity.badRequest().body(new ApiError(ACCOUNT_NOT_CREATED));
		}
		return ResponseEntity.status(HttpStatus.CREATED).body(new AccountView(id, email));
	}

	@PostMapping("/api/auth/logout")
	public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
		HttpSession session = httpRequest.getSession(false);
		if (session != null) {
			session.invalidate();
		}
		securityContextHolderStrategy.clearContext();
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/api/auth/login")
	public ResponseEntity<?> login(
			@RequestBody LoginRequest request,
			HttpServletRequest httpRequest,
			HttpServletResponse httpResponse) {
		String email = Emails.normalize(request.email());
		String ip = clientIp(httpRequest);
		String emailKey = "email:" + email;
		String ipKey = "ip:" + ip;
		if (attempts.isBlocked(emailKey) || attempts.isBlocked(ipKey)) {
			return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
					.body(new ApiError("Too many login attempts"));
		}
		String password = request.password() == null ? "" : request.password();
		try {
			Authentication authentication = authenticationManager.authenticate(
					UsernamePasswordAuthenticationToken.unauthenticated(email, password));
			AccountUser user = ((AccountUser) authentication.getPrincipal()).withoutSecret();
			Authentication stored = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
			SecurityContext context = securityContextHolderStrategy.createEmptyContext();
			context.setAuthentication(stored);
			securityContextHolderStrategy.setContext(context);
			securityContextRepository.saveContext(context, httpRequest, httpResponse);
			attempts.reset(emailKey);
			return ResponseEntity.ok(new AccountView(user.id(), user.email()));
		} catch (AuthenticationException exception) {
			attempts.recordFailure(emailKey);
			attempts.recordFailure(ipKey);
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError(INVALID_LOGIN));
		}
	}

	private static String clientIp(HttpServletRequest request) {
		String address = request.getRemoteAddr();
		return address == null || address.isBlank() ? "unknown" : address;
	}

	public record RegisterRequest(String email, String password, String inviteCode) {
	}

	public record LoginRequest(String email, String password) {
	}

	public record AccountView(UUID id, String email) {
	}
}
