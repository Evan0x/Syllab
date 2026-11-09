package io.github.evan0x.syllacal.security;

import java.util.Locale;

public final class Emails {

	private Emails() {
	}

	public static String normalize(String email) {
		if (email == null) {
			return "";
		}
		return email.trim().toLowerCase(Locale.ROOT);
	}
}
