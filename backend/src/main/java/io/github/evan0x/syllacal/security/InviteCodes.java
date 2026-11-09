package io.github.evan0x.syllacal.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class InviteCodes {

	private InviteCodes() {
	}

	public static boolean matches(String configured, String provided) {
		if (configured == null || configured.isBlank()) {
			return false;
		}
		String candidate = provided == null ? "" : provided;
		return MessageDigest.isEqual(digest(configured), digest(candidate));
	}

	private static byte[] digest(String value) {
		try {
			return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is not available", exception);
		}
	}
}
