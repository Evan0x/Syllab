package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.advisor.AdvisorModel;
import io.github.evan0x.syllacal.advisor.AdvisorReplies;
import io.github.evan0x.syllacal.advisor.CourseAdvisor;
import io.github.evan0x.syllacal.advisor.CourseAdvisor.Analysis;
import io.github.evan0x.syllacal.advisor.CourseAdvisor.CourseInput;
import io.github.evan0x.syllacal.advisor.CourseAdvisor.EventInput;
import io.github.evan0x.syllacal.advisor.CourseAdvisor.Prompt;
import io.github.evan0x.syllacal.security.AccountUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
public class AdvisorController {

	private static final ZoneId CALENDAR_ZONE = ZoneId.of("America/New_York");
	private static final int MAX_QUESTION = 500;
	private static final int MAX_TURNS = 6;
	private static final int MAX_TURN = 500;

	private final JdbcTemplate jdbc;
	private final AdvisorModel model;

	public AdvisorController(JdbcTemplate jdbc, AdvisorModel model) {
		this.jdbc = jdbc;
		this.model = model;
	}

	@GetMapping("/api/advisor")
	public Analysis advisor(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
		AccountUser user = MeController.currentUser();
		return CourseAdvisor.analyze(day(today), courses(user.id()), events(user.id()));
	}

	@PostMapping("/api/advisor/ask")
	public AskResponse ask(@RequestBody(required = false) AskRequest request) {
		if (request == null || request.question() == null || request.question().isBlank()) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "A question is required");
		}
		String question = request.question().trim().replaceAll("\\s+", " ");
		if (question.length() > MAX_QUESTION) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "Question is too long");
		}
		AccountUser user = MeController.currentUser();
		Selection selection = select(user, request.courseIds());
		LocalDate today = day(request.today());
		Prompt prompt = CourseAdvisor.prompt(today, selection.courses(), selection.events());
		if (!model.available()) {
			return withheld(prompt.analysis(), "unavailable");
		}
		try {
			String userText = CourseAdvisor.userText(prompt.text(), question, earlierTurns(request.history()));
			AdvisorModel.ModelReply reply = model.complete(userText);
			String allowed = prompt.text() + "\n" + question;
			String answer = AdvisorReplies.keepAnswer(reply.answer(), allowed);
			if (answer == null) {
				return withheld(prompt.analysis(), "rejected");
			}
			List<Citation> citations = citations(citedLabels(reply), prompt, selection.events());
			List<String> missing = new ArrayList<>(prompt.analysis().missing());
			for (String note : AdvisorReplies.keepNotes(reply.missing(), allowed)) {
				if (!missing.contains(note)) {
					missing.add(note);
				}
			}
			return new AskResponse(true, answer, citations, List.copyOf(missing), "answered");
		}
		catch (RuntimeException exception) {
			return withheld(prompt.analysis(), "unavailable");
		}
	}

	private static List<String> citedLabels(AdvisorModel.ModelReply reply) {
		List<String> labels = new ArrayList<>();
		if (reply.citedEvents() != null) {
			labels.addAll(reply.citedEvents());
		}
		if (reply.answer() != null) {
			Matcher matcher = Pattern.compile("(?i)Label\\s+([A-Z]+)").matcher(reply.answer());
			while (matcher.find()) {
				labels.add(matcher.group(1));
			}
		}
		return labels;
	}

	private AskResponse withheld(Analysis analysis, String status) {
		return new AskResponse(false, null, List.of(), analysis.missing(), status);
	}

	private List<Citation> citations(List<String> labels, Prompt prompt, List<EventInput> events) {
		List<Citation> citations = new ArrayList<>();
		for (String label : AdvisorReplies.keepLabels(labels, prompt.labels().keySet())) {
			UUID eventId = prompt.labels().get(label);
			EventInput event = events.stream().filter(item -> eventId.equals(item.id())).findFirst().orElse(null);
			if (event == null) {
				continue;
			}
			String courseName = prompt.analysis().courses().stream()
					.filter(course -> course.id().equals(event.courseId()))
					.map(CourseAdvisor.CourseBrief::name)
					.findFirst()
					.orElse("Untitled course");
			citations.add(new Citation(
					event.id(),
					courseName,
					event.title(),
					event.type(),
					event.date(),
					event.weight() == null ? null : event.weight().stripTrailingZeros(),
					event.quote()));
		}
		return List.copyOf(citations);
	}

	private Selection select(AccountUser user, List<String> courseIds) {
		List<CourseInput> ownedCourses = courses(user.id());
		List<EventInput> ownedEvents = events(user.id());
		if (courseIds == null || courseIds.isEmpty()) {
			return new Selection(ownedCourses, ownedEvents);
		}
		Set<UUID> requested = new LinkedHashSet<>();
		for (String raw : courseIds) {
			UUID id = parse(raw);
			if (id != null) {
				requested.add(id);
			}
		}
		for (UUID id : requested) {
			UUID owner = courseOwner(id);
			if (owner != null && !owner.equals(user.id())) {
				throw new SyllabusRequestException(HttpStatus.NOT_FOUND, "Course was not found");
			}
		}
		List<CourseInput> chosen = ownedCourses.stream().filter(course -> requested.contains(course.id())).toList();
		List<EventInput> chosenEvents = ownedEvents.stream().filter(event -> requested.contains(event.courseId())).toList();
		return new Selection(chosen, chosenEvents);
	}

	private List<String> earlierTurns(List<Turn> history) {
		if (history == null || history.isEmpty()) {
			return List.of();
		}
		int start = Math.max(0, history.size() - MAX_TURNS);
		List<String> turns = new ArrayList<>();
		for (Turn turn : history.subList(start, history.size())) {
			if (turn == null || turn.text() == null || turn.role() == null) {
				continue;
			}
			String role = turn.role().trim().toLowerCase(Locale.ROOT);
			String speaker = switch (role) {
				case "user" -> "Student";
				case "assistant" -> "Advisor";
				default -> null;
			};
			if (speaker == null) {
				continue;
			}
			String text = turn.text().trim().replaceAll("\\s+", " ");
			if (text.isEmpty()) {
				continue;
			}
			if (text.length() > MAX_TURN) {
				text = text.substring(0, MAX_TURN);
			}
			turns.add(speaker + ": " + text);
		}
		return turns;
	}

	private List<CourseInput> courses(UUID userId) {
		return jdbc.query("""
				select id, name, term_start, term_end
				from courses
				where user_id = ?
				order by name, term_start
				""", (rs, row) -> new CourseInput(
				rs.getObject("id", UUID.class),
				rs.getString("name"),
				sqlDate(rs.getDate("term_start")),
				sqlDate(rs.getDate("term_end"))), userId);
	}

	private List<EventInput> events(UUID userId) {
		return jdbc.query("""
				select id, course_id, title, type, event_date, start_time, end_time, location,
					weight_percent, confidence, source_quote
				from events
				where user_id = ? and review_status = 'CONFIRMED'
				order by event_date, start_time nulls last, title
				""", (rs, row) -> {
			java.sql.Time start = rs.getTime("start_time");
			java.sql.Time end = rs.getTime("end_time");
			BigDecimal weight = rs.getBigDecimal("weight_percent");
			return new EventInput(
					rs.getObject("id", UUID.class),
					rs.getObject("course_id", UUID.class),
					rs.getString("title"),
					rs.getString("type"),
					rs.getDate("event_date").toLocalDate(),
					start == null ? null : start.toLocalTime(),
					end == null ? null : end.toLocalTime(),
					blankToNull(rs.getString("location")),
					weight == null ? null : weight.stripTrailingZeros(),
					blankToNull(rs.getString("confidence")),
					blankToNull(rs.getString("source_quote")));
		}, userId);
	}

	private UUID courseOwner(UUID courseId) {
		List<UUID> owners = jdbc.query(
				"select user_id from courses where id = ?",
				(rs, row) -> rs.getObject("user_id", UUID.class),
				courseId);
		return owners.isEmpty() ? null : owners.getFirst();
	}

	private static LocalDate day(LocalDate today) {
		return today == null ? LocalDate.now(CALENDAR_ZONE) : today;
	}

	private static LocalDate sqlDate(Date date) {
		return date == null ? null : date.toLocalDate();
	}

	private static UUID parse(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		try {
			return UUID.fromString(raw.trim());
		}
		catch (IllegalArgumentException exception) {
			return null;
		}
	}

	private static String blankToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}

	private record Selection(List<CourseInput> courses, List<EventInput> events) {
	}

	public record AskRequest(LocalDate today, List<String> courseIds, String question, List<Turn> history) {
	}

	public record Turn(String role, String text) {
	}

	public record Citation(
			UUID eventId,
			String courseName,
			String title,
			String type,
			LocalDate date,
			BigDecimal weight,
			String quote) {
	}

	public record AskResponse(boolean available, String answer, List<Citation> citations, List<String> missing, String status) {
	}
}
