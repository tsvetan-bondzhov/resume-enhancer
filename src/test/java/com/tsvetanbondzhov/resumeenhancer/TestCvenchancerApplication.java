package com.tsvetanbondzhov.resumeenhancer;

import org.springframework.boot.SpringApplication;

public class TestCvenchancerApplication {

	public static void main(String[] args) {
		SpringApplication.from(CvenchancerApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
