package io.github.evan0x.syllacal.workload;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class GeminiWorkloadModel {

	private static final String BASE_URL = "https://generativelanguage.googleapis.com";

	private final RestClient restClient;
	private final JsonMapper jsonMapper;
	private final String apiKey;
	private final String model;

	public GeminiWorkloadModel(
			RestClient.Builder restClientBuilder,
			JsonMapper jsonMapper,
			@Value("${gemini.api-key}") String apiKey,
			@Value("${gemini.model}") String model) {
		this.restClient = restClientBuilder.baseUrl(BASE_URL).build();
		this.jsonMapper = jsonMapper;
		this.apiKey = apiKey == null ? "" : apiKey;
		this.model = model;
	}

	public boolean available() {
		return !apiKey.isBlank();
	}

	public List<String> complete(String factSheet) {
		String body = restClient.post()
				.uri("/v1beta/models/{model}:generateContent", model)
				.header("x-goog-api-key", apiKey)
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(request(factSheet))
				.exchange((request, response) -> {
					byte[] bytes = response.getBody().readAllBytes();
					if (response.getStatusCode().isError()) {
						throw new IllegalStateException("Workload suggestions were not available");
					}
					return new String(bytes, StandardCharsets.UTF_8);
				});
		return readSuggestions(body);
	}

	private List<String> readSuggestions(String responseBody) {
		JsonNode parts = jsonMapper.readTree(responseBody).path("candidates").path(0).path("content").path("parts");
		String text = null;
		if (parts.isArray()) {
			for (JsonNode part : parts) {
				if (part.path("thought").asBoolean(false)) {
					continue;
				}
				if (part.path("text").isString() && !part.path("text").asString().isBlank()) {
					text = part.path("text").asString();
				}
			}
		}
		if (text == null) {
			throw new IllegalStateException("Workload suggestions were not available");
		}
		JsonNode suggestions = jsonMapper.readTree(text).path("suggestions");
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

	private static Map<String, Object> request(String factSheet) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", """
				You suggest how a student might prepare for the workload in the facts.
				Use only the course names, dates, and numbers in the facts.
				Do not invent assignment durations, difficulty, grades, weights, or events.
				Do not add a number that is not in the facts.
				Write at most 3 short suggestions.
				"""))));
		body.put("contents", List.of(Map.of("parts", List.of(Map.of("text", factSheet)))));
		Map<String, Object> generationConfig = new LinkedHashMap<>();
		generationConfig.put("temperature", 0);
		generationConfig.put("thinkingConfig", Map.of("thinkingLevel", "minimal"));
		generationConfig.put("responseMimeType", "application/json");
		generationConfig.put("responseSchema", Map.of(
				"type", "OBJECT",
				"properties", Map.of("suggestions", Map.of("type", "ARRAY", "items", Map.of("type", "STRING"))),
				"required", List.of("suggestions")));
		body.put("generationConfig", generationConfig);
		return body;
	}
}
