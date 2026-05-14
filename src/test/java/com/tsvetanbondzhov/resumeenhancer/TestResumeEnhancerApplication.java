package com.tsvetanbondzhov.resumeenhancer;

import org.springframework.boot.SpringApplication;

public class TestResumeEnhancerApplication {

	public static void main(String[] args) {
		SpringApplication.from(ResumeEnhancerApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
