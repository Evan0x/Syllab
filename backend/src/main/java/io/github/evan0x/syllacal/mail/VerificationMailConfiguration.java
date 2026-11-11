package io.github.evan0x.syllacal.mail;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.nio.charset.StandardCharsets;
import java.util.Properties;

@Configuration
public class VerificationMailConfiguration {

	@Bean
	@Conditional(MailHostConfigured.class)
	JavaMailSender verificationMailSender(Environment environment) {
		JavaMailSenderImpl sender = new JavaMailSenderImpl();
		sender.setHost(environment.getRequiredProperty("MAIL_HOST"));
		sender.setDefaultEncoding(StandardCharsets.UTF_8.name());
		String port = environment.getProperty("MAIL_PORT");
		if (port != null && !port.isBlank()) {
			sender.setPort(Integer.parseInt(port));
		}
		String username = environment.getProperty("MAIL_USERNAME");
		String password = environment.getProperty("MAIL_PASSWORD");
		Properties properties = new Properties();
		properties.setProperty("mail.smtp.connectiontimeout", "5000");
		properties.setProperty("mail.smtp.timeout", "3000");
		properties.setProperty("mail.smtp.writetimeout", "5000");
		if (username != null && !username.isBlank()) {
			sender.setUsername(username);
			if (password != null && !password.isBlank()) {
				sender.setPassword(password);
			}
			properties.setProperty("mail.smtp.auth", "true");
		}
		sender.setJavaMailProperties(properties);
		return sender;
	}

	public static class MailHostConfigured implements Condition {

		@Override
		public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
			String host = context.getEnvironment().getProperty("MAIL_HOST");
			return host != null && !host.isBlank();
		}
	}
}
