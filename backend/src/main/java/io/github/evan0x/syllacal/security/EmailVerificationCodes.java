package io.github.evan0x.syllacal.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class EmailVerificationCodes {

	public static final Duration TTL = Duration.ofMinutes(15);

	private final JdbcTemplate jdbc;
	private final SecureRandom random = new SecureRandom();

	public EmailVerificationCodes(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public String issue(UUID userId) {
		byte[] bytes = new byte[16];
		random.nextBytes(bytes);
		String code = HexFormat.of().formatHex(bytes);
		OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plus(TTL);
		jdbc.update(
				"insert into email_verification_codes (id, user_id, code_hash, expires_at) values (?, ?, ?, ?)",
				UUID.randomUUID(),
				userId,
				hash(code),
				expiresAt);
		return code;
	}

	@Transactional
	public boolean consume(UUID userId, String code) {
		if (code == null || code.isBlank()) {
			return false;
		}
		byte[] presented = digest(code);
		List<StoredCode> codes = jdbc.query(
				"""
				select id, code_hash, expires_at, used_at
				from email_verification_codes
				where user_id = ?
				order by expires_at desc
				""",
				(rs, row) -> new StoredCode(
						rs.getObject("id", UUID.class),
						rs.getString("code_hash"),
						rs.getObject("expires_at", OffsetDateTime.class),
						rs.getObject("used_at", OffsetDateTime.class)),
				userId);
		OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
		for (StoredCode stored : codes) {
			if (stored.usedAt() != null || !stored.expiresAt().isAfter(now)) {
				continue;
			}
			if (!MessageDigest.isEqual(digestHex(stored.codeHash()), presented)) {
				continue;
			}
			int consumed = jdbc.update(
					"update email_verification_codes set used_at = ? where id = ? and used_at is null",
					now,
					stored.id());
			if (consumed != 1) {
				return false;
			}
			jdbc.update("update users set email_verified = true where id = ?", userId);
			return true;
		}
		return false;
	}

	private static String hash(String code) {
		return HexFormat.of().formatHex(digest(code));
	}

	private static byte[] digestHex(String hex) {
		return HexFormat.of().parseHex(hex);
	}

	private static byte[] digest(String value) {
		try {
			return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is not available", exception);
		}
	}

	private record StoredCode(UUID id, String codeHash, OffsetDateTime expiresAt, OffsetDateTime usedAt) {
	}
}
