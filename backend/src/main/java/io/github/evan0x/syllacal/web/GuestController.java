package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.security.AccountRepository;
import io.github.evan0x.syllacal.security.AccountUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@RestController
public class GuestController {

	private final AccountRepository accounts;
	private final SecurityContextHolderStrategy securityContextHolderStrategy =
			SecurityContextHolder.getContextHolderStrategy();
	private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

	public GuestController(AccountRepository accounts) {
		this.accounts = accounts;
	}

	@PostMapping("/api/guest/session")
	public ResponseEntity<?> createGuestSession(HttpServletRequest request, HttpServletResponse response) {
		Authentication existing = securityContextHolderStrategy.getContext().getAuthentication();
		if (existing != null && existing.isAuthenticated() && existing.getPrincipal() instanceof AccountUser) {
			return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError("Already signed in"));
		}
		UUID id = UUID.randomUUID();
		String email = "guest-" + id + "@syllapin.internal";
		OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(7);
		if (!accounts.insertGuest(id, email, expiresAt)) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiError("Could not start guest session"));
		}
		AccountUser user = new AccountUser(id, email, null, true, true, 0);
		Authentication stored = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
		SecurityContext context = securityContextHolderStrategy.createEmptyContext();
		context.setAuthentication(stored);
		securityContextHolderStrategy.setContext(context);
		securityContextRepository.saveContext(context, request, response);
		return ResponseEntity.ok(new AccountView(id, email, true, 0));
	}

	public record AccountView(UUID id, String email, boolean isGuest, int trialsUsed) {}
}
