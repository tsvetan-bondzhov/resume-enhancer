package com.tsvetanbondzhov.resumeenhancer.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.LoginRequest;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.SignupRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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

    @Autowired
    private TokenService tokenService;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

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

    // ─── Login tests ───

    @Test
    void login_validCredentials_returns200WithToken() throws Exception {
        userRepository.deleteAll();

        // First register a user
        SignupRequest signup = new SignupRequest("loginuser@example.com", "Password1");
        webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(signup))
                .exchange()
                .expectStatus().isCreated();

        // Then login
        LoginRequest login = new LoginRequest("loginuser@example.com", "Password1");
        webTestClient().post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(login))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.token").isNotEmpty();
    }

    @Test
    void login_unknownEmail_returns401ProblemDetail() throws Exception {
        userRepository.deleteAll();

        LoginRequest login = new LoginRequest("nobody@example.com", "Password1");

        webTestClient().post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(login))
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Unauthorized")
                .jsonPath("$.detail").isEqualTo("Invalid email or password");
    }

    @Test
    void login_wrongPassword_returns401ProblemDetail() throws Exception {
        userRepository.deleteAll();

        // Register user
        SignupRequest signup = new SignupRequest("wrongpass@example.com", "Password1");
        webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(signup))
                .exchange()
                .expectStatus().isCreated();

        // Login with wrong password
        LoginRequest login = new LoginRequest("wrongpass@example.com", "WrongPassword");
        webTestClient().post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(login))
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Unauthorized")
                .jsonPath("$.detail").isEqualTo("Invalid email or password");
    }

    @Test
    void login_blankEmail_returns400ProblemDetail() throws Exception {
        LoginRequest login = new LoginRequest("", "Password1");

        webTestClient().post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(login))
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Bad Request")
                .jsonPath("$.errors.email").isNotEmpty();
    }

    @Test
    void protectedEndpoint_withoutToken_returns401ProblemDetail() {
        webTestClient().get()
                .uri("/api/v1/profile")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Unauthorized");
    }

    @Test
    void protectedEndpoint_withExpiredToken_returns401ProblemDetail() {
        // Build a short-lived TokenService using the same secret as the application context,
        // but with a negative expiration so the token is immediately expired.
        TokenService expiredTokenService = new TokenService(jwtSecret, -1000L,
                java.time.Clock.fixed(java.time.Instant.parse("2025-01-01T00:00:00Z"), java.time.ZoneOffset.UTC));
        com.tsvetanbondzhov.resumeenhancer.auth.domain.User dummyUser =
                new com.tsvetanbondzhov.resumeenhancer.auth.domain.User();
        dummyUser.setEmail("expired@example.com");
        dummyUser.setRole("USER");
        dummyUser.setEnabled(true);
        dummyUser.setPasswordHash("");
        String expiredToken = expiredTokenService.generateToken(dummyUser);

        webTestClient().get()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + expiredToken)
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Unauthorized")
                .jsonPath("$.detail").isEqualTo("Invalid or expired token");
    }
}
