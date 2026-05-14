package com.tsvetanbondzhov.resumeenhancer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class ResumeEnhancerApplication {

	public static void main(String[] args) {
		SpringApplication.run(ResumeEnhancerApplication.class, args);
	}

}
