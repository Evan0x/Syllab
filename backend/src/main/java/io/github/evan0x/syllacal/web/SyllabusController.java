package io.github.evan0x.syllacal.web;

import io.github.evan0x.syllacal.calendar.EventValidator;
import io.github.evan0x.syllacal.calendar.IcsBuilder;
import io.github.evan0x.syllacal.calendar.ValidationResult;
import io.github.evan0x.syllacal.extraction.EventExtractor;
import io.github.evan0x.syllacal.extraction.ExtractedEvent;
import io.github.evan0x.syllacal.pdf.PdfTextExtractor;
import io.github.evan0x.syllacal.pdf.ScannedPdfException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@RestController
public class SyllabusController {

	static final long MAX_FILE_BYTES = 10L * 1024 * 1024;

	static final int MAX_EXPORT_EVENTS = 200;

	static final int MAX_COURSE_NAME_CHARS = 200;

	static final int MAX_TITLE_CHARS = 300;

	static final int MAX_LOCATION_CHARS = 200;

	static final int MAX_SOURCE_QUOTE_CHARS = 500;

	private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

	private final PdfTextExtractor pdfTextExtractor;
	private final EventExtractor eventExtractor;
	private final EventValidator eventValidator;
	private final IcsBuilder icsBuilder;

	public SyllabusController(
			PdfTextExtractor pdfTextExtractor,
			EventExtractor eventExtractor,
			EventValidator eventValidator,
			IcsBuilder icsBuilder) {
		this.pdfTextExtractor = pdfTextExtractor;
		this.eventExtractor = eventExtractor;
		this.eventValidator = eventValidator;
		this.icsBuilder = icsBuilder;
	}

	/**
	 * Creates a calendar from a PDF file.
	 * @param file The PDF file to create a calendar from.
	 * @param courseName The name of the course.
	 * @param termStart The start date of the term.
	 * @param termEnd The end date of the term.
	 * @return The calendar in ICS format.
	 * @throws ScannedPdfException If the PDF file is not a valid PDF.
	 * @throws IOException If there is an error reading the PDF file.
	 */
	@PostMapping("/api/syllabus")
	public ResponseEntity<String> createCalendar(
			@RequestParam("file") MultipartFile file,
			@RequestParam("courseName") String courseName,
			@RequestParam("termStart") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate termStart,
			@RequestParam("termEnd") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate termEnd)
			throws ScannedPdfException, IOException {
		String course = requireCourseName(courseName);
		requireTerm(termStart, termEnd);
		byte[] pdf = requirePdf(file);

		String syllabusText;
		try {
			syllabusText = pdfTextExtractor.extract(new ByteArrayInputStream(pdf));
		}
		catch (IOException exception) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, pdfReadMessage(exception));
		}

		List<ExtractedEvent> extracted = eventExtractor.extract(syllabusText, termStart, termEnd);
		ValidationResult validated = eventValidator.validate(extracted, termStart, termEnd);
		String ics = icsBuilder.build(validated.validEvents(), course);

		ContentDisposition disposition = ContentDisposition.attachment()
				.filename(filename(course), StandardCharsets.UTF_8)
				.build();
		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType("text/calendar"))
				.header("Content-Disposition", disposition.toString())
				.body(ics);
	}


	/**
	 * Previews the calendar for a given course.
	 * @param file The PDF file to preview.
	 * @param courseName The name of the course.
	 * @param termStart The start date of the term.
	 * @param termEnd The end date of the term.
	 * @return The extracted events and validation warnings.
	 * @throws ScannedPdfException If the PDF file is not a valid PDF.
	 * @throws IOException If there is an error reading the PDF file.
	 */
	@PostMapping("/api/syllabus/preview")
	public ResponseEntity<PreviewResponse> preview(
			@RequestParam("file") MultipartFile file,
			@RequestParam("courseName") String courseName,
			@RequestParam("termStart") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate termStart,
			@RequestParam("termEnd") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate termEnd)
			throws ScannedPdfException, IOException {
		String course = requireCourseName(courseName);
		requireTerm(termStart, termEnd);
		byte[] pdf = requirePdf(file);

		String syllabusText;
		try {
			syllabusText = pdfTextExtractor.extract(new ByteArrayInputStream(pdf));
		}
		catch (IOException exception) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, pdfReadMessage(exception));
		}

		List<ExtractedEvent> extracted = eventExtractor.extract(syllabusText, termStart, termEnd);
		ValidationResult validated = eventValidator.validate(extracted, termStart, termEnd);
		List<CalendarEvent> events = validated.validEvents().stream()
				.map(event -> new CalendarEvent(
						event.title(),
						event.type(),
						event.date(),
						event.time(),
						event.endTime(),
						event.location(),
						event.weightPercent(),
						event.confidence(),
						event.sourceText()))
				.toList();

		return ResponseEntity.ok(new PreviewResponse(course, events, validated.warnings()));
	}

	@PostMapping("/api/syllabus/export")
	public ResponseEntity<String> export(@RequestBody ExportRequest request) {
		String course = requireCourseName(request.courseName());
		if (course.length() > MAX_COURSE_NAME_CHARS) {
			throw new SyllabusRequestException(
					HttpStatus.BAD_REQUEST, "courseName must be at most 200 characters");
		}
		List<CalendarEvent> submitted = request.events();
		if (submitted == null) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "events is required");
		}
		if (submitted.size() > MAX_EXPORT_EVENTS) {
			throw new SyllabusRequestException(
					HttpStatus.BAD_REQUEST, "events must contain at most 200 events");
		}

		List<ExtractedEvent> events = new ArrayList<>();
		for (int index = 0; index < submitted.size(); index++) {
			events.add(toExtractedEvent(submitted.get(index), index));
		}
		String ics = icsBuilder.build(events, course);
		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType("text/calendar;charset=UTF-8"))
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"syllacal.ics\"")
				.body(ics);
	}

	private static ExtractedEvent toExtractedEvent(CalendarEvent event, int index) {
		if (event == null) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "events[" + index + "] is required");
		}
		if (event.title() == null || event.title().isBlank()) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "events[" + index + "].title is required");
		}
		if (event.date() == null) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "events[" + index + "].date is required");
		}
		if (event.time() == null && event.endTime() != null) {
			throw new SyllabusRequestException(
					HttpStatus.BAD_REQUEST, "events[" + index + "].endTime requires a start time");
		}
		if (event.time() != null && event.endTime() != null && !event.endTime().isAfter(event.time())) {
			throw new SyllabusRequestException(
					HttpStatus.BAD_REQUEST, "events[" + index + "].endTime must be after time");
		}
		String title = event.title().trim();
		if (title.length() > MAX_TITLE_CHARS) {
			throw new SyllabusRequestException(
					HttpStatus.BAD_REQUEST, "events[" + index + "].title must be at most 300 characters");
		}
		String location = event.location() == null || event.location().isBlank() ? null : event.location().trim();
		if (location != null && location.length() > MAX_LOCATION_CHARS) {
			throw new SyllabusRequestException(
					HttpStatus.BAD_REQUEST, "events[" + index + "].location must be at most 200 characters");
		}
		String sourceQuote = event.sourceQuote();
		if (sourceQuote != null && sourceQuote.length() > MAX_SOURCE_QUOTE_CHARS) {
			throw new SyllabusRequestException(
					HttpStatus.BAD_REQUEST, "events[" + index + "].sourceQuote must be at most 500 characters");
		}
		return new ExtractedEvent(
				title,
				event.type(),
				event.date(),
				event.time(),
				event.endTime(),
				location,
				event.weightPercent(),
				event.confidence(),
				sourceQuote);
	}


	private static String requireCourseName(String courseName) {
		if (courseName == null || courseName.isBlank()) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "courseName is required");
		}
		return courseName.trim();
	}

	private static void requireTerm(LocalDate termStart, LocalDate termEnd) {
		if (termEnd.isBefore(termStart)) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "termEnd must be on or after termStart");
		}
	}

	private static byte[] requirePdf(MultipartFile file) throws IOException {
		if (file == null || file.isEmpty()) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "A PDF file is required");
		}
		if (file.getSize() > MAX_FILE_BYTES) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "File exceeds the 10 MB limit");
		}
		byte[] bytes = file.getBytes();
		if (!isPdf(bytes)) {
			throw new SyllabusRequestException(HttpStatus.BAD_REQUEST, "File is not a PDF");
		}
		return bytes;
	}

	static boolean isPdf(byte[] bytes) {
		if (bytes == null || bytes.length < PDF_MAGIC.length) {
			return false;
		}
		for (int i = 0; i < PDF_MAGIC.length; i++) {
			if (bytes[i] != PDF_MAGIC[i]) {
				return false;
			}
		}
		return true;
	}

	private static String pdfReadMessage(IOException exception) {
		String message = exception.getMessage();
		if (message != null && message.toLowerCase().contains("encrypt")) {
			return "Encrypted PDFs are not supported";
		}
		return "The file is not a readable PDF";
	}

	private static String filename(String courseName) {
		String safe = courseName.replaceAll("[^A-Za-z0-9._-]+", "_");
		if (safe.isBlank()) {
			safe = "syllabus";
		}
		return safe + ".ics";
	}

	

}
