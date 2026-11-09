package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.calendar.EventValidator;
import io.github.evan0x.syllacal.calendar.IcsBuilder;
import io.github.evan0x.syllacal.pdf.PdfTextExtractor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SyllabusController.class)
@Import({
		PdfTextExtractor.class,
		EventValidator.class,
		IcsBuilder.class,
		SyllabusControllerTest.FakeExtractor.class
})
class SyllabusExportTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void validExportReturnsAnIcsFile() throws Exception {
		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "courseName": "HIST 125",
								  "events": [
								    {
								      "title": "Map Quiz",
								      "type": "QUIZ",
								      "date": "2026-09-09",
								      "time": null,
								      "endTime": null,
								      "location": null,
								      "weightPercent": 5.0,
								      "confidence": "HIGH"
								    }
								  ]
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(header().string("Content-Type", containsString("text/calendar")))
				.andExpect(header().string("Content-Type", containsString("charset=UTF-8")))
				.andExpect(header().string("Content-Disposition", "attachment; filename=\"syllacal.ics\""))
				.andExpect(content().string(containsString("BEGIN:VCALENDAR")))
				.andExpect(content().string(containsString("SUMMARY:Map Quiz")))
				.andExpect(content().string(containsString("DTSTART;VALUE=DATE:20260909")))
				.andExpect(content().string(containsString("END:VCALENDAR")));
	}

	@Test
	void editedTitleAppearsInTheIcs() throws Exception {
		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body("Midterm Examination (revised)", "2026-10-07", null, null, null)))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("SUMMARY:Midterm Examination (revised)")));
	}

	@Test
	void editedDateAndTimeAppearInTheIcs() throws Exception {
		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(
								"Final Exam",
								"2026-12-14",
								"13:30:00",
								"16:15:00",
								"Exploratory Hall L004")))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("SUMMARY:Final Exam")))
				.andExpect(content().string(containsString("TZID=America/New_York")))
				.andExpect(content().string(containsString("20261214T133000")))
				.andExpect(content().string(containsString("20261214T161500")))
				.andExpect(content().string(containsString("LOCATION:Exploratory Hall L004")));
	}

	@Test
	void newlyAddedEventAppearsInTheIcs() throws Exception {
		String json = """
				{
				  "courseName": "HIST 125",
				  "events": [
				    {
				      "title": "Map Quiz",
				      "date": "2026-09-09"
				    },
				    {
				      "title": "Office hours",
				      "date": "2026-09-11",
				      "time": "15:00:00",
				      "location": "Horizon Hall 1234"
				    }
				  ]
				}
				""";

		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content(json))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("SUMMARY:Office hours")))
				.andExpect(content().string(containsString("DTSTART;VALUE=DATE:20260909")))
				.andExpect(content().string(containsString("20260911T150000")))
				.andExpect(content().string(containsString("LOCATION:Horizon Hall 1234")));
	}

	@Test
	void omittedEventDoesNotAppearInTheIcs() throws Exception {
		String json = """
				{
				  "courseName": "HIST 125",
				  "events": [
				    {
				      "title": "Map Quiz",
				      "date": "2026-09-09"
				    },
				    {
				      "title": "Final Exam",
				      "date": "2026-12-14"
				    }
				  ]
				}
				""";

		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content(json))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("SUMMARY:Map Quiz")))
				.andExpect(content().string(containsString("SUMMARY:Final Exam")))
				.andExpect(content().string(not(containsString("SUMMARY:Midterm Examination"))));
	}

	@Test
	void optionalFieldsCanBeNull() throws Exception {
		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body("In-Class Essay", "2026-11-30", null, null, null)))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("SUMMARY:In-Class Essay")))
				.andExpect(content().string(containsString("DTSTART;VALUE=DATE:20261130")))
				.andExpect(content().string(not(containsString("LOCATION:"))));
	}

	@Test
	void invalidEventDataIsRejected() throws Exception {
		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "courseName": "HIST 125",
								  "events": [
								    {
								      "title": " ",
								      "date": "2026-09-09"
								    }
								  ]
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("events[0].title is required"));

		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "courseName": "HIST 125",
								  "events": [
								    {
								      "title": "Map Quiz",
								      "date": null
								    }
								  ]
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("events[0].date is required"));

		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "courseName": "HIST 125",
								  "events": [
								    {
								      "title": "Final Exam",
								      "date": "2026-13-14",
								      "time": "13:30:00"
								    }
								  ]
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message")
						.value("A date must be YYYY-MM-DD and a time must be HH:mm or HH:mm:ss"));

		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "courseName": "HIST 125",
								  "events": [
								    {
								      "title": "Final Exam",
								      "date": "2026-12-14",
								      "time": "16:15:00",
								      "endTime": "13:30:00"
								    }
								  ]
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("events[0].endTime must be after time"));
	}

	@Test
	void exportWithSourceQuoteAddsOneSourceLine() throws Exception {
		String ics = exportIcs("""
				{
				  "courseName": "HIST 125",
				  "events": [
				    {
				      "title": "Map Quiz",
				      "date": "2026-09-09",
				      "weightPercent": 5,
				      "sourceQuote": "Map Quiz is on September 9"
				    }
				  ]
				}
				""");
		String unfolded = unfold(ics);
		assertThat(occurrences(unfolded, "Source:")).isEqualTo(1);
		assertThat(unfolded).contains("DESCRIPTION:Weight: 5%\\nSource: Map Quiz is on September 9");
	}

	@Test
	void exportWithoutSourceQuoteHasNoSourceLine() throws Exception {
		String ics = exportIcs(body("Map Quiz", "2026-09-09", null, null, null));
		assertThat(unfold(ics)).doesNotContain("Source:");

		String explicitNull = exportIcs("""
				{
				  "courseName": "HIST 125",
				  "events": [
				    {
				      "title": "Map Quiz",
				      "date": "2026-09-09",
				      "sourceQuote": null
				    }
				  ]
				}
				""");
		assertThat(unfold(explicitNull)).doesNotContain("Source:");
	}

	@Test
	void exportWithBlankSourceQuoteHasNoSourceLine() throws Exception {
		String ics = exportIcs("""
				{
				  "courseName": "HIST 125",
				  "events": [
				    {
				      "title": "Map Quiz",
				      "date": "2026-09-09",
				      "sourceQuote": " \\n\\t "
				    }
				  ]
				}
				""");
		assertThat(unfold(ics)).doesNotContain("Source:");
	}

	@Test
	void sourceQuoteCannotInjectExtraEvents() throws Exception {
		String quote = "notes\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Injected";
		String ics = exportIcs("""
				{
				  "courseName": "HIST 125",
				  "events": [
				    {
				      "title": "Map Quiz",
				      "date": "2026-09-09",
				      "sourceQuote": %s
				    }
				  ]
				}
				""".formatted(jsonString(quote)));
		String unfolded = unfold(ics);
		assertThat(unfolded.lines().filter(line -> line.startsWith("BEGIN:VEVENT")).count()).isEqualTo(1);
		assertThat(unfolded.lines().filter(line -> line.startsWith("END:VEVENT")).count()).isEqualTo(1);
		assertThat(unfolded.lines().filter(line -> line.startsWith("SUMMARY:")).toList())
				.containsExactly("SUMMARY:Map Quiz");
		assertThat(occurrences(unfolded, "Source:")).isEqualTo(1);
	}

	@Test
	void exportAcceptsTwoHundredEventsAndRejectsTwoHundredOne() throws Exception {
		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content(eventsJson(200, "Q")))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("BEGIN:VCALENDAR")));

		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content(eventsJson(201, "Q")))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.message").value("events must contain at most 200 events"));
	}

	@Test
	void exportAcceptsFiveHundredCharacterQuoteAndRejectsFiveHundredOne() throws Exception {
		String accepted = exportIcs("""
				{
				  "courseName": "HIST 125",
				  "events": [
				    {
				      "title": "Map Quiz",
				      "date": "2026-09-09",
				      "sourceQuote": "%s"
				    }
				  ]
				}
				""".formatted("a".repeat(500)));
		assertThat(occurrences(unfold(accepted), "Source:")).isEqualTo(1);

		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "courseName": "HIST 125",
								  "events": [
								    {
								      "title": "Map Quiz",
								      "date": "2026-09-09",
								      "sourceQuote": "%s"
								    }
								  ]
								}
								""".formatted("a".repeat(501))))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.message").value("events[0].sourceQuote must be at most 500 characters"));
	}

	@Test
	void emptyEventListReturnsACalendarWithNoEvents() throws Exception {
		mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "courseName": "HIST 125",
								  "events": []
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("BEGIN:VCALENDAR")))
				.andExpect(content().string(containsString("END:VCALENDAR")))
				.andExpect(content().string(not(containsString("BEGIN:VEVENT"))));
	}

	private static String body(String title, String date, String time, String endTime, String location) {
		return """
				{
				  "courseName": "HIST 125",
				  "events": [
				    {
				      "title": "%s",
				      "date": "%s",
				      "time": %s,
				      "endTime": %s,
				      "location": %s
				    }
				  ]
				}
				""".formatted(title, date, jsonValue(time), jsonValue(endTime), jsonValue(location));
	}

	private static String jsonValue(String value) {
		return value == null ? "null" : "\"" + value + "\"";
	}

	private String exportIcs(String json) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/syllabus/export")
						.contentType(MediaType.APPLICATION_JSON)
						.content(json))
				.andExpect(status().isOk())
				.andReturn();
		return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	private static String eventsJson(int count, String titlePrefix) {
		StringBuilder json = new StringBuilder();
		json.append("{\"courseName\":\"HIST 125\",\"events\":[");
		for (int index = 0; index < count; index++) {
			if (index > 0) {
				json.append(',');
			}
			json.append("{\"title\":\"")
					.append(titlePrefix)
					.append(index)
					.append("\",\"date\":\"2026-09-09\"}");
		}
		json.append("]}");
		return json.toString();
	}

	private static String jsonString(String value) {
		return "\"" + value
				.replace("\\", "\\\\")
				.replace("\"", "\\\"")
				.replace("\r", "\\r")
				.replace("\n", "\\n")
				.replace("\t", "\\t") + "\"";
	}

	private static String unfold(String ics) {
		return ics.replace("\r\n", "\n").replaceAll("\n[ \\t]", "");
	}

	private static int occurrences(String text, String needle) {
		int count = 0;
		int from = 0;
		while (from < text.length()) {
			int found = text.indexOf(needle, from);
			if (found < 0) {
				return count;
			}
			count++;
			from = found + needle.length();
		}
		return count;
	}
}
