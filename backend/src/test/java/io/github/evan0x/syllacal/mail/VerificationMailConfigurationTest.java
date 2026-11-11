package io.github.evan0x.syllacal.mail;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.TestPropertySource;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = VerificationMailConfiguration.class)
class VerificationMailConfigurationTest {

	@Autowired
	private ObjectProvider<JavaMailSender> mailSenders;

	@Test
	void noMailSenderIsCreatedWhenTheHostIsAbsent() {
		assertThat(mailSenders.getIfAvailable()).isNull();
	}
}

@SpringBootTest(classes = VerificationMailConfiguration.class)
@TestPropertySource(properties = {
		"MAIL_HOST=smtp.example.test",
		"MAIL_PORT=587",
		"MAIL_USERNAME=mailer",
		"MAIL_PASSWORD=mail-secret"
})
class VerificationMailSettingsTest {

	@Autowired
	private JavaMailSender mailSender;

	@Test
	void smtpSettingsComeFromTheMailEnvironmentVariables() {
		JavaMailSenderImpl sender = (JavaMailSenderImpl) mailSender;
		assertThat(sender.getHost()).isEqualTo("smtp.example.test");
		assertThat(sender.getPort()).isEqualTo(587);
		assertThat(sender.getUsername()).isEqualTo("mailer");
		assertThat(sender.getPassword()).isEqualTo("mail-secret");
		assertThat(sender.getDefaultEncoding()).isEqualTo("UTF-8");
		Properties properties = sender.getJavaMailProperties();
		assertThat(properties.getProperty("mail.smtp.auth")).isEqualTo("true");
		assertThat(properties.getProperty("mail.smtp.connectiontimeout")).isEqualTo("5000");
		assertThat(properties.getProperty("mail.smtp.timeout")).isEqualTo("3000");
		assertThat(properties.getProperty("mail.smtp.writetimeout")).isEqualTo("5000");
	}
}
