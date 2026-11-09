package io.github.evan0x.syllacal.extraction;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class QuoteVerifierTest {

	private final QuoteVerifier verifier = new QuoteVerifier();

	@Test
	void exactMatch() {
		assertThat(verifier.appearsIn(
				"Office hours are held on Wednesday.",
				"Office hours are held on Wednesday.")).isTrue();
	}

	@Test
	void sameWordsWithDifferentSpacingAndLineBreaks() {
		assertThat(verifier.appearsIn(
				"Submit the essay by Monday.",
				"Submit   the\nessay\nby\tMonday.")).isTrue();
	}

	@Test
	void differentUpperAndLowerCase() {
		assertThat(verifier.appearsIn(
				"The Lab Report Is Due Friday.",
				"the lab report is due friday.")).isTrue();
	}

	@Test
	void curlyAndStraightQuotesAndApostrophes() {
		assertThat(verifier.appearsIn(
				"Read \u201cDon\u2019t skip the sample.\u201d",
				"Read \"Don't skip the sample.\"")).isTrue();
	}

	@Test
	void hyphenatedLineBreakInsideTheQuote() {
		assertThat(verifier.appearsIn(
				"The exam-\nination is closed book.",
				"The examination is closed book.")).isTrue();
	}

	@Test
	void quoteSpansAPageBreak() {
		assertThat(verifier.appearsIn(
				"Bring a pencil for the quiz.",
				"Bring a pencil\n\nfor the quiz.")).isTrue();
	}

	@Test
	void quoteIsNotInTheText() {
		assertThat(verifier.appearsIn(
				"The poster session is on Thursday.",
				"Bring a pencil for the quiz.")).isFalse();
	}

	@Test
	void nearMatchDiffersByOneWord() {
		assertThat(verifier.appearsIn(
				"The midterm covers chapters one and three.",
				"The midterm covers chapters one and two.")).isFalse();
	}

	@Test
	void nullQuote() {
		assertThat(verifier.appearsIn(null, "Bring a pencil for the quiz.")).isFalse();
	}

	@Test
	void blankQuote() {
		assertThat(verifier.appearsIn(" \n\t ", "Bring a pencil for the quiz.")).isFalse();
	}

	@Test
	void nullSourceText() {
		assertThat(verifier.appearsIn("Bring a pencil for the quiz.", null)).isFalse();
	}

	@Test
	@DisplayName("A quote with 10 letters and digits that is present returns true")
	void quoteOfTenAlphanumericsThatIsPresent() {
		assertThat(verifier.appearsIn("final exams", "The final exams are in December")).isTrue();
	}

	@Test
	@DisplayName("A quote with 9 letters and digits is too short, even if present")
	void quoteOfNineAlphanumericsIsTooShort() {
		assertThat(verifier.appearsIn("final exam", "The final exam is in December")).isFalse();
	}

	@Test
	@DisplayName("non-breaking space in the source matches a normal space in the quote")
	void nonBreakingSpaceMatchesNormalSpace() {
		assertThat(verifier.appearsIn(
				"Meet at the lab.",
				"Meet\u00A0at the lab.")).isTrue();
	}

	@Test
	@DisplayName("an en dash in the source matches a plain hyphen in the quote")
	void enDashMatchesPlainHyphen() {
		assertThat(verifier.appearsIn(
				"10:30 - 11:30 am",
				"10:30 \u2013 11:30 am")).isTrue();
	}

	@Test
	@DisplayName("an fi ligature in the source matches the letters final in the quote")
	void fiLigatureMatchesFinal() {
		assertThat(verifier.appearsIn(
				"Submit the final draft.",
				"Submit the \uFB01nal draft.")).isTrue();
	}

	@Test
	@DisplayName("a real hyphen in a word broken across lines is kept")
	void realHyphenBrokenAcrossLinesIsKept() {
		assertThat(verifier.appearsIn(
				"a well-known deadline",
				"a well-\nknown deadline")).isTrue();
	}

	@Test
	@DisplayName("a soft hyphen inside a source word still matches the quote")
	void softHyphenInsideSourceWord() {
		assertThat(verifier.appearsIn(
				"The examination is closed.",
				"The exam\u00ADination is closed.")).isTrue();
	}

	@Test
	@DisplayName("changing one number from 10:30 to 12:30 does not match")
	void changedNumberDoesNotMatch() {
		assertThat(verifier.appearsIn(
				"Section meets at 12:30 today.",
				"Section meets at 10:30 today.")).isFalse();
	}

	@Test
	@DisplayName("changing one word does not match")
	void changedWordDoesNotMatch() {
		assertThat(verifier.appearsIn(
				"Bring a marker for the quiz.",
				"Bring a pencil for the quiz.")).isFalse();
	}
}
