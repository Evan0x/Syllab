package io.github.evan0x.syllacal.security;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class VerifiedOauthAccounts {

	private final AccountRepository accounts;

	public VerifiedOauthAccounts(AccountRepository accounts) {
		this.accounts = accounts;
	}

	@Transactional
	public Optional<AccountUser> link(String email) {
		String normalized = Emails.normalize(email);
		if (normalized.isEmpty() || !normalized.contains("@") || normalized.contains(" ")) {
			return Optional.empty();
		}
		Optional<AccountRepository.StoredAccount> existing = accounts.findByEmail(normalized);
		if (existing.isPresent()) {
			AccountRepository.StoredAccount account = existing.get();
			accounts.markEmailVerified(account.id());
			return Optional.of(new AccountUser(account.id(), account.email(), account.passwordHash(), true));
		}
		UUID id = UUID.randomUUID();
		if (!accounts.insertVerified(id, normalized)) {
			return accounts.findByEmail(normalized)
					.map(account -> {
						accounts.markEmailVerified(account.id());
						return new AccountUser(account.id(), account.email(), account.passwordHash(), true);
					});
		}
		return Optional.of(new AccountUser(id, normalized, null, true));
	}
}
