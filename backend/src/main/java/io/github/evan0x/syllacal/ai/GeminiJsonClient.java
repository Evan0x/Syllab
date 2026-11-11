package io.github.evan0x.syllacal.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class GeminiJsonClient {

	private static final String BASE_URL = "https://generativelanguage.googleapis.com";

	private final RestClient restClient;
	private final JsonMapper jsonMapper;
	private final String apiKey;
	private final String model;

	public GeminiJsonClient(
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

	public String generate(String systemInstruction, String userText, Map<String, Object> responseSchema) {
		try {
			String body = restClient.post()
					.uri("/v1beta/models/{model}:generateContent", model)
					.header("x-goog-api-key", apiKey)
					.contentType(MediaType.APPLICATION_JSON)
					.accept(MediaType.APPLICATION_JSON)
					.body(request(systemInstruction, userText, responseSchema))
					.exchange((request, response) -> {
						byte[] bytes = response.getBody().readAllBytes();
						if (response.getStatusCode().isError()) {
							throw new IllegalStateException("The model request failed");
						}
						return new String(bytes, StandardCharsets.UTF_8);
					});
			return modelText(body);
		}
		catch (RuntimeException exception) {
			throw new IllegalStateException("The model request failed");
		}
	}

	private String modelText(String responseBody) {
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
			throw new IllegalStateException("The model request failed");
		}
		return text;
	}

	private static Map<String, Object> request(
			String systemInstruction, String userText, Map<String, Object> responseSchema) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))));
		body.put("contents", List.of(Map.of("parts", List.of(Map.of("text", userText)))));
		Map<String, Object> generationConfig = new LinkedHashMap<>();
		generationConfig.put("temperature", 0);
		generationConfig.put("thinkingConfig", Map.of("thinkingLevel", "minimal"));
		generationConfig.put("responseMimeType", "application/json");
		generationConfig.put("responseSchema", responseSchema);
		body.put("generationConfig", generationConfig);
		return body;
	}
}
