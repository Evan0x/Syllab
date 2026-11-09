package io.github.evan0x.syllacal.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			@Value("${server.servlet.session.cookie.secure:true}") boolean secureCookies) throws Exception {
		CookieCsrfTokenRepository tokens = CookieCsrfTokenRepository.withHttpOnlyFalse();
		tokens.setCookieCustomizer(cookie -> cookie.sameSite("Lax").secure(secureCookies));
		http
				.csrf(csrf -> csrf.spa().csrfTokenRepository(tokens))
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.logout(AbstractHttpConfigurer::disable)
				.exceptionHandling(errors -> errors
						.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
						.accessDeniedHandler((request, response, denied) -> {
							response.setStatus(HttpStatus.FORBIDDEN.value());
							response.setContentType("application/json");
							response.getWriter().write("{\"message\":\"Forbidden\"}");
						}))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
						.requestMatchers("/api/syllabus", "/api/syllabus/**").permitAll()
						.anyRequest().authenticated());
		return http.build();
	}

	@Bean
	AuthenticationManager authenticationManager(AccountUserDetailsService users, PasswordEncoder passwordEncoder) {
		DaoAuthenticationProvider provider = new DaoAuthenticationProvider(users);
		provider.setPasswordEncoder(passwordEncoder);
		return new org.springframework.security.authentication.ProviderManager(provider);
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}
}
