package io.github.evan0x.syllacal;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(PostgresTestcontainersConfiguration.class)
class SyllacalApplicationTests {

	@Test
	void contextLoads() {
	}

}
