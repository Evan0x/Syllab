package io.github.evan0x.syllacal.security;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginAttemptLimiter {

	static final int LIMIT = 5;
	static final Duration WINDOW = Duration.ofMinutes(15);

	private final Clock clock;
	private final ConcurrentHashMap<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

	public LoginAttemptLimiter() {
		this(Clock.systemUTC());
	}

	LoginAttemptLimiter(Clock clock) {
		this.clock = clock;
	}

	public boolean isBlocked(String key) {
		Deque<Instant> attempts = failures.get(key);
		if (attempts == null) {
			return false;
		}
		synchronized (attempts) {
			prune(attempts);
			return attempts.size() >= LIMIT;
		}
	}

	public void recordFailure(String key) {
		Deque<Instant> attempts = failures.computeIfAbsent(key, ignored -> new ArrayDeque<>());
		synchronized (attempts) {
			prune(attempts);
			attempts.addLast(clock.instant());
		}
	}

	public void reset(String key) {
		failures.remove(key);
	}

	private void prune(Deque<Instant> attempts) {
		Instant cutoff = clock.instant().minus(WINDOW);
		while (!attempts.isEmpty() && attempts.peekFirst().isBefore(cutoff)) {
			attempts.removeFirst();
		}
	}
}
