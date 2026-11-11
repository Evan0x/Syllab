package io.github.evan0x.syllacal.workload;

import io.github.evan0x.syllacal.ai.GeminiJsonClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class GeminiWorkloadModel {

	private static final String SYSTEM = """
			You suggest how a student might prepare for the workload in the facts.
			Use only the course names, dates, and numbers in the facts.
			Do not invent assignment durations, difficulty, grades, weights, or events.
			Do not add a number that is not in the facts.
			Write at most 3 short suggestions.
			""";

	private final GeminiJsonClient gemini;
	private final JsonMapper jsonMapper;

	public GeminiWorkloadModel(GeminiJsonClient gemini, JsonMapper jsonMapper) {
		this.gemini = gemini;
		this.jsonMapper = jsonMapper;
	}

	public boolean available() {
		return gemini.available();
	}

	public List<String> complete(String factSheet) {
		try {
			return readSuggestions(gemini.generate(SYSTEM, factSheet, schema()));
		}
		catch (RuntimeException exception) {
			throw new IllegalStateException("Workload suggestions were not available");
		}
	}

	private List<String> readSuggestions(String modelText) {
		JsonNode suggestions = jsonMapper.readTree(modelText).path("suggestions");
		List<String> values = new ArrayList<>();
		if (suggestions.isArray()) {
			for (JsonNode suggestion : suggestions) {
				if (suggestion.isString()) {
					values.add(suggestion.asString());
				}
			}
		}
		return values;
	}

	private static Map<String, Object> schema() {
		return Map.of(
				"type", "OBJECT",
				"properties", Map.of("suggestions", Map.of("type", "ARRAY", "items", Map.of("type", "STRING"))),
				"required", List.of("suggestions"));
	}
}
