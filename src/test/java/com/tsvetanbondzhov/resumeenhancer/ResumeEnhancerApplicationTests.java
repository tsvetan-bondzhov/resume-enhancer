package com.tsvetanbondzhov.resumeenhancer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.junit.jupiter.api.Assertions.assertTrue;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class ResumeEnhancerApplicationTests {

	@Test
	void contextLoads() {
		assertTrue(true); // Context loads without throwing — verified by @SpringBootTest itself
	}

}
