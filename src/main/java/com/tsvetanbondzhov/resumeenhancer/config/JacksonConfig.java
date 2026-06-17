package com.tsvetanbondzhov.resumeenhancer.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tsvetanbondzhov.resumeenhancer.common.FlexibleLocalDateDeserializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.LocalDate;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        SimpleModule flexibleDateModule = new SimpleModule("FlexibleLocalDate");
        flexibleDateModule.addDeserializer(LocalDate.class, new FlexibleLocalDateDeserializer());

        return new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .registerModule(flexibleDateModule)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

}
