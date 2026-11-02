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
}
