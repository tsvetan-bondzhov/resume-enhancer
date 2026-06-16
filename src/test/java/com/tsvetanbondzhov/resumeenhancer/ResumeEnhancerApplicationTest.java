package com.tsvetanbondzhov.resumeenhancer;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

class ResumeEnhancerApplicationTest {

    @Test
    void main_invokesSpringApplicationRun() {
        ConfigurableApplicationContext mockContext = mock(ConfigurableApplicationContext.class);
        try (MockedStatic<SpringApplication> springApp = mockStatic(SpringApplication.class)) {
            springApp.when(() -> SpringApplication.run(any(Class.class), any(String[].class)))
                     .thenReturn(mockContext);

            ResumeEnhancerApplication.main(new String[]{});

            springApp.verify(() -> SpringApplication.run(ResumeEnhancerApplication.class, new String[]{}));
        }
    }

}
