package io.github.evan0x.syllacal.extraction;

import java.util.Locale;
import java.text.Normalizer;

public class QuoteVerifier {

	/**
	 * Normalize both strings the same way (collapse all whitespace, including line
	 * breaks and blank lines, to single spaces; lowercase; treat curly and straight
	 * quotes and apostrophes as the same; remove hyphenation line breaks such as
	 * "exam-\nination"), then return whether the normalized quote is a substring of
	 * the normalized source text. A null or blank quote returns false. A null source
	 * text returns false. A quote shorter than 10 characters after normalization
	 * returns false, because a very short string matches almost anywhere.
	 */
	public boolean appearsIn(String quote, String sourceText) {
		if (quote == null || sourceText == null) {
			return false;
		}
		String q = normalize(quote);
		String s = normalize(sourceText);
		if(q.length() < 10) {
			return false;
		}
		return s.contains(q);
	}

	private String normalize(String text) {
		String t = Normalizer.normalize(text, Normalizer.Form.NFKC);   // ligatures, NBSP -> space
		t = t.replace("\u00AD", "");                                   // soft hyphen
		return t.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", "");
	}
}
