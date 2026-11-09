package io.github.evan0x.syllacal.security;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AccountUserDetailsService implements UserDetailsService {

	private final AccountRepository accounts;

	public AccountUserDetailsService(AccountRepository accounts) {
		this.accounts = accounts;
	}

	@Override
	public UserDetails loadUserByUsername(String username) {
		String email = Emails.normalize(username);
		return accounts.findByEmail(email)
				.map(account -> new AccountUser(account.id(), account.email(), account.passwordHash()))
				.orElseThrow(() -> new UsernameNotFoundException("No account"));
	}
}
