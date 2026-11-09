package io.github.evan0x.syllacal.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public final class AccountUser implements UserDetails {

	private final UUID id;
	private final String email;
	private final String passwordHash;

	public AccountUser(UUID id, String email, String passwordHash) {
		this.id = id;
		this.email = email;
		this.passwordHash = passwordHash;
	}

	public UUID id() {
		return id;
	}

	public String email() {
		return email;
	}

	public AccountUser withoutSecret() {
		return new AccountUser(id, email, null);
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of(new SimpleGrantedAuthority("ROLE_USER"));
	}

	@Override
	public String getPassword() {
		return passwordHash;
	}

	@Override
	public String getUsername() {
		return email;
	}
}
