package com.tsvetanbondzhov.resumeenhancer.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.SignupRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(webEnvironment = RANDOM_PORT)
@ActiveProfiles("test")
@Import(AuthControllerIntegrationTest.ContainersConfig.class)
class AuthControllerIntegrationTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class ContainersConfig {
        @Bean
        @ServiceConnection
        PostgreSQLContainer postgresContainer() {
            return new PostgreSQLContainer(DockerImageName.parse("postgres:16"));
        }
    }

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private WebTestClient webTestClient() {
        return WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .build();
    }

    @Test
    void signup_happyPath_returns201WithToken() throws Exception {
        userRepository.deleteAll();

        SignupRequest request = new SignupRequest("newuser@example.com", "securePass1");

        webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(request))
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.token").isNotEmpty();
    }

    @Test
    void signup_duplicateEmail_returns409ProblemDetail() throws Exception {
        userRepository.deleteAll();

        SignupRequest request = new SignupRequest("duplicate@example.com", "securePass1");

        // First registration
        webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(request))
                .exchange()
                .expectStatus().isCreated();

        // Second registration with same email
        webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(request))
                .exchange()
                .expectStatus().isEqualTo(409)
                .expectBody()
                .jsonPath("$.title").isEqualTo("Conflict")
                .jsonPath("$.detail").isNotEmpty();
    }

    @Test
    void signup_invalidEmailFormat_returns400ProblemDetail() throws Exception {
        SignupRequest request = new SignupRequest("not-an-email", "securePass1");

        webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(request))
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Bad Request")
                .jsonPath("$.errors.email").isNotEmpty();
    }

    @Test
    void signup_blankPassword_returns400ProblemDetail() throws Exception {
        SignupRequest request = new SignupRequest("valid@example.com", "");

        webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(request))
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Bad Request")
                .jsonPath("$.errors.password").isNotEmpty();
    }
}
