package io.github.evan0x.syllacal.security;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AccountRepository {

	private final JdbcTemplate jdbc;

	public AccountRepository(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public Optional<StoredAccount> findByEmail(String email) {
		return jdbc.query(
				"select id, email, password_hash, email_verified, is_guest, trials_used from users where email = ?",
				(rs, row) -> new StoredAccount(
						rs.getObject("id", UUID.class),
						rs.getString("email"),
						rs.getString("password_hash"),
						rs.getBoolean("email_verified"),
						rs.getBoolean("is_guest"),
						rs.getInt("trials_used")),
				email)
				.stream()
				.findFirst();
	}

	public boolean insert(UUID id, String email, String passwordHash) {
		try {
			jdbc.update(
					"insert into users (id, email, password_hash, email_verified) values (?, ?, ?, false)",
					id,
					email,
					passwordHash);
			return true;
		} catch (DataIntegrityViolationException exception) {
			return false;
		}
	}

	public boolean insertVerified(UUID id, String email) {
		try {
			jdbc.update(
					"insert into users (id, email, password_hash, email_verified) values (?, ?, null, true)",
					id,
					email);
			return true;
		} catch (DataIntegrityViolationException exception) {
			return false;
		}
	}

	public boolean insertGuest(UUID id, String email, OffsetDateTime expiresAt) {
		try {
			jdbc.update(
					"insert into users (id, email, password_hash, email_verified, is_guest, expires_at, trials_used) values (?, ?, null, true, true, ?, 0)",
					id,
					email,
					expiresAt);
			return true;
		} catch (DataIntegrityViolationException exception) {
			return false;
		}
	}

	public void markEmailVerified(UUID id) {
		jdbc.update("update users set email_verified = true where id = ?", id);
	}

	public void incrementTrialsUsed(UUID id) {
		jdbc.update("update users set trials_used = trials_used + 1 where id = ? and is_guest = true", id);
	}

	public void upgradeGuest(UUID id, String email, String passwordHash) {
		jdbc.update(
				"update users set email = ?, password_hash = ?, is_guest = false, email_verified = false, expires_at = null where id = ? and is_guest = true",
				email,
				passwordHash,
				id);
	}

	public void delete(UUID id) {
		jdbc.update("delete from users where id = ?", id);
	}

	public record StoredAccount(UUID id, String email, String passwordHash, boolean emailVerified, boolean isGuest, int trialsUsed) {
	}
}
