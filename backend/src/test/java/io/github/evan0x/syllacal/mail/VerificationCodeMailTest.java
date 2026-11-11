package io.github.evan0x.syllacal.mail;

import io.github.evan0x.syllacal.security.EmailVerificationCodes;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class VerificationCodeMailTest {

	private static final String FROM = "noreply@syllapin.test";
	private static final String EMAIL = "student@school.edu";
	private static final String CODE = "c0ffee";
	private static final String PASSWORD = "password12";

	@Test
	void configuredMailIsPlainTextFromSyllapinWithTheCodeAndExpiryOnly() {
		CapturingMailSender mailSender = new CapturingMailSender();
		VerificationCodeMail mail = mail(mailSender, "smtp.example.test", FROM);

		mail.send(EMAIL, CODE);

		SimpleMailMessage message = mailSender.sent;
		assertThat(message).isNotNull();
		assertThat(message.getFrom()).isEqualTo("Syllapin <" + FROM + ">");
		assertThat(message.getTo()).containsExactly(EMAIL);
		assertThat(message.getSubject()).isEqualTo("Syllapin verification code");
		assertThat(message.getText()).isEqualTo(
				CODE + "\nThis code expires in " + EmailVerificationCodes.TTL.toMinutes() + " minutes.");
		assertThat(message.getFrom()).doesNotContain(PASSWORD).doesNotContain(CODE);
		assertThat(message.getSubject()).doesNotContain(PASSWORD).doesNotContain(CODE);
		assertThat(message.getText()).doesNotContain(PASSWORD).doesNotContain(EMAIL);
	}

	@Test
	void absentHostFromOrSenderSendsNothing() {
		CapturingMailSender mailSender = new CapturingMailSender();
		ObjectProvider<JavaMailSender> blankHost = provider(mailSender);
		new VerificationCodeMail(blankHost, "", FROM).send(EMAIL, CODE);
		verify(blankHost, never()).getIfAvailable();

		ObjectProvider<JavaMailSender> blankFrom = provider(mailSender);
		new VerificationCodeMail(blankFrom, "smtp.example.test", "").send(EMAIL, CODE);
		verify(blankFrom, never()).getIfAvailable();

		new VerificationCodeMail(provider(null), "smtp.example.test", FROM).send(EMAIL, CODE);
		assertThat(mailSender.sent).isNull();
	}

	@Test
	void aMailFailureDoesNotEscapeWithTheMessage() {
		CapturingMailSender mailSender = new CapturingMailSender();
		mailSender.failure = new MailSendException(CODE);
		VerificationCodeMail mail = mail(mailSender, "smtp.example.test", FROM);

		mail.send(EMAIL, CODE);

		assertThat(mailSender.sent).isNotNull();
	}

	private static VerificationCodeMail mail(JavaMailSender mailSender, String host, String from) {
		return new VerificationCodeMail(provider(mailSender), host, from);
	}

	@SuppressWarnings("unchecked")
	private static ObjectProvider<JavaMailSender> provider(JavaMailSender mailSender) {
		ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
		when(provider.getIfAvailable()).thenReturn(mailSender);
		return provider;
	}

	private static final class CapturingMailSender extends JavaMailSenderImpl {

		private SimpleMailMessage sent;
		private MailSendException failure;

		@Override
		public void send(SimpleMailMessage... simpleMessages) {
			this.sent = simpleMessages[0];
			if (this.failure != null) {
				throw this.failure;
			}
		}
	}
}
