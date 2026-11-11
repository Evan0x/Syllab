package io.github.evan0x.syllacal.mail;

import io.github.evan0x.syllacal.security.EmailVerificationCodes;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class VerificationCodeMail {

	private final ObjectProvider<JavaMailSender> mailSenders;
	private final String host;
	private final String from;

	public VerificationCodeMail(
			ObjectProvider<JavaMailSender> mailSenders,
			@Value("${MAIL_HOST:}") String host,
			@Value("${MAIL_FROM:}") String from) {
		this.mailSenders = mailSenders;
		this.host = host;
		this.from = from;
	}

	public void send(String email, String code) {
		if (host == null || host.isBlank() || from == null || from.isBlank()) {
			return;
		}
		JavaMailSender mailSender = mailSenders.getIfAvailable();
		if (mailSender == null) {
			return;
		}
		SimpleMailMessage message = new SimpleMailMessage();
		message.setFrom("Syllapin <" + from + ">");
		message.setTo(email);
		message.setSubject("Syllapin verification code");
		message.setText(code + "\nThis code expires in " + EmailVerificationCodes.TTL.toMinutes() + " minutes.");
		try {
			mailSender.send(message);
		} catch (MailException exception) {
			// MailException text can include the message body. Do not log it.
		}
	}
}
