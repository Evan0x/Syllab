package io.github.evan0x.syllacal.workload;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class WorkloadSuggestions {

	private static final Pattern NUMBER = Pattern.compile("\\d+");
	private static final int MAX_SUGGESTIONS = 3;
	private static final int MAX_LENGTH = 240;

	private WorkloadSuggestions() {
	}

	public static List<String> keep(List<String> suggestions, String factSheet) {
		if (suggestions == null || suggestions.isEmpty()) {
			return List.of();
		}
		Set<String> allowed = numbersIn(factSheet == null ? "" : factSheet);
		List<String> kept = new ArrayList<>();
		for (String suggestion : suggestions) {
			if (suggestion == null) {
				continue;
			}
			String text = suggestion.trim().replaceAll("\\s+", " ");
			if (text.isEmpty() || text.length() > MAX_LENGTH || !numbersAllowed(text, allowed)) {
				continue;
			}
			kept.add(text);
			if (kept.size() == MAX_SUGGESTIONS) {
				break;
			}
		}
		return List.copyOf(kept);
	}

	private static boolean numbersAllowed(String text, Set<String> allowed) {
		Matcher matcher = NUMBER.matcher(text);
		while (matcher.find()) {
			if (!allowed.contains(matcher.group())) {
				return false;
			}
		}
		return true;
	}

	private static Set<String> numbersIn(String text) {
		Set<String> numbers = new java.util.LinkedHashSet<>();
		Matcher matcher = NUMBER.matcher(text);
		while (matcher.find()) {
			numbers.add(matcher.group());
		}
		return numbers;
	}
}
