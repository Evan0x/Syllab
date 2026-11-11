package io.github.evan0x.syllacal.advisor;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AdvisorReplies {

	private static final Pattern NUMBER = Pattern.compile("\\d+");
	private static final Pattern REJECTED = Pattern.compile(
			"(?i)(graduat|degree requirement|\\b(one|two|three|four|five|six|seven|eight|nine|ten)\\s+hours?\\b|\\d+\\s*hours?|you are free|you will be free|harder than)");
	private static final int MAX_ANSWER = 1200;
	private static final int MAX_NOTES = 3;
	private static final int MAX_NOTE = 160;
	private static final int MAX_CITATIONS = 6;

	private AdvisorReplies() {
	}

	public static String keepAnswer(String answer, String allowedText) {
		return "ok".equals(reason(answer, allowedText)) ? withoutLabels(answer) : null;
	}

	static String reason(String answer, String allowedText) {
		if (answer == null) {
			return "blank";
		}
		String text = withoutLabels(answer);
		if (text.isEmpty()) {
			return "blank";
		}
		if (text.length() > MAX_ANSWER) {
			return "long";
		}
		if (REJECTED.matcher(text).find()) {
			return "policy";
		}
		String number = disallowedNumber(text, allowedText);
		return number == null ? "ok" : "number " + number;
	}

	public static List<String> keepLabels(List<String> labels, Set<String> known) {
		if (labels == null || labels.isEmpty() || known == null || known.isEmpty()) {
			return List.of();
		}
		List<String> kept = new ArrayList<>();
		for (String label : labels) {
			if (label == null) {
				continue;
			}
			String key = label.trim().toUpperCase(Locale.ROOT).replaceFirst("^LABEL\\s+", "");
			if (!known.contains(key) || kept.contains(key)) {
				continue;
			}
			kept.add(key);
			if (kept.size() == MAX_CITATIONS) {
				break;
			}
		}
		return List.copyOf(kept);
	}

	public static List<String> keepNotes(List<String> notes, String allowedText) {
		if (notes == null || notes.isEmpty()) {
			return List.of();
		}
		List<String> kept = new ArrayList<>();
		for (String note : notes) {
			if (note == null) {
				continue;
			}
			String text = note.trim().replaceAll("\\s+", " ");
			if (text.isEmpty() || text.length() > MAX_NOTE || REJECTED.matcher(text).find() || disallowedNumber(text, allowedText) != null) {
				continue;
			}
			kept.add(text);
			if (kept.size() == MAX_NOTES) {
				break;
			}
		}
		return List.copyOf(kept);
	}

	private static String disallowedNumber(String text, String allowedText) {
		Set<String> allowed = numbersIn(allowedText);
		Matcher matcher = NUMBER.matcher(text);
		while (matcher.find()) {
			String number = matcher.group();
			if (!allowed.contains(number) && !clockAlias(number, allowedText)) {
				return number;
			}
		}
		return null;
	}

	private static boolean clockAlias(String number, String allowedText) {
		int value;
		try {
			value = Integer.parseInt(number);
		}
		catch (NumberFormatException exception) {
			return false;
		}
		if (value < 1 || value > 12) {
			return false;
		}
		Matcher times = Pattern.compile("\\b(\\d{1,2}):\\d{2}").matcher(allowedText);
		while (times.find()) {
			int hour = Integer.parseInt(times.group(1));
			int twelveHour = hour % 12 == 0 ? 12 : hour % 12;
			if (twelveHour == value) {
				return true;
			}
		}
		return false;
	}

	private static String withoutLabels(String answer) {
		return answer.trim()
				.replaceAll("(?i)\\s*\\(\\s*label\\s+[a-z]+\\s*\\)", "")
				.replaceAll("(?i)\\s*label\\s+[a-z]+\\b", "")
				.replaceAll("\\s+", " ")
				.trim();
	}

	private static Set<String> numbersIn(String text) {
		Set<String> numbers = new java.util.LinkedHashSet<>();
		Matcher matcher = NUMBER.matcher(text == null ? "" : text);
		while (matcher.find()) {
			numbers.add(matcher.group());
		}
		return numbers;
	}
}
