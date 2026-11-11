package io.github.evan0x.syllacal.advisor;

import io.github.evan0x.syllacal.ai.GeminiJsonClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class AdvisorModel {

	static final String SYSTEM = """
			You are a course planning assistant for one student.
			Use only the facts. Earlier turns are context, and the facts win if they disagree.
			Do not invent deadlines, weights, grading policies, professor rules, study hours, free days, degree requirements, or graduation eligibility.
			Do not say a course is harder.
			If a detail is missing, say it is not saved.
			When you mention a deadline or a weight, put its event label in citedEvents.
			Do not write the label in the answer.
			Write one answer of at most 800 characters.
			This is not official academic advising.
			""";

	private final GeminiJsonClient gemini;
	private final JsonMapper jsonMapper;

	public AdvisorModel(GeminiJsonClient gemini, JsonMapper jsonMapper) {
		this.gemini = gemini;
		this.jsonMapper = jsonMapper;
	}

	public boolean available() {
		return gemini.available();
	}

	public ModelReply complete(String userText) {
		return read(jsonMapper, gemini.generate(SYSTEM, userText, schema()));
	}

	static ModelReply read(JsonMapper jsonMapper, String modelText) {
		JsonNode root = jsonMapper.readTree(modelText);
		String answer = root.path("answer").isString() ? root.path("answer").asString() : "";
		List<String> cited = new ArrayList<>();
		JsonNode labels = root.path("citedEvents");
		if (labels.isArray()) {
			for (JsonNode label : labels) {
				if (label.isString()) {
					cited.add(label.asString());
				}
			}
		}
		List<String> missing = new ArrayList<>();
		JsonNode notes = root.path("missing");
		if (notes.isArray()) {
			for (JsonNode note : notes) {
				if (note.isString()) {
					missing.add(note.asString());
				}
			}
		}
		return new ModelReply(answer, List.copyOf(cited), List.copyOf(missing));
	}

	private static Map<String, Object> schema() {
		Map<String, Object> properties = Map.of(
				"answer", Map.of("type", "STRING"),
				"citedEvents", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
				"missing", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")));
		return Map.of("type", "OBJECT", "properties", properties, "required", List.of("answer", "citedEvents", "missing"));
	}

	public record ModelReply(String answer, List<String> citedEvents, List<String> missing) {
	}
}
