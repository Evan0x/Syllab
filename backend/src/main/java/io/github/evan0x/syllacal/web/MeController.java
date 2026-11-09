package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.security.AccountRepository;
import io.github.evan0x.syllacal.security.AccountUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {

	private final AccountRepository accounts;

	public MeController(AccountRepository accounts) {
		this.accounts = accounts;
	}

	@GetMapping("/api/me")
	public AccountView me() {
		AccountUser user = currentUser();
		return new AccountView(user.id(), user.email());
	}

	@DeleteMapping("/api/me")
	public ResponseEntity<Void> delete(HttpServletRequest request) {
		AccountUser user = currentUser();
		accounts.delete(user.id());
		HttpSession session = request.getSession(false);
		if (session != null) {
			session.invalidate();
		}
		SecurityContextHolder.getContextHolderStrategy().clearContext();
		return ResponseEntity.noContent().build();
	}

	static AccountUser currentUser() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof AccountUser user)) {
			throw new SyllabusRequestException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Authentication required");
		}
		return user;
	}

	public record AccountView(java.util.UUID id, String email) {
	}
}
