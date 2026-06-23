package com.tsvetanbondzhov.resumeenhancer.admin;

import com.tsvetanbondzhov.resumeenhancer.auth.TokenService;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(webEnvironment = RANDOM_PORT)
@ActiveProfiles("test")
@Import(AdminControllerIntegrationTest.ContainersConfig.class)
class AdminControllerIntegrationTest {

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
    private UserRepository userRepository;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User admin;
    private User regular;
    private String adminToken;
    private String userToken;

    private WebTestClient webTestClient() {
        return WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .build();
    }

    private User seedUser(String email, String role, boolean enabled) {
        User u = new User();
        u.setEmail(email);
        u.setRole(role);
        u.setEnabled(enabled);
        u.setPasswordHash(passwordEncoder.encode("Password1"));
        return userRepository.save(u);
    }

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        admin = seedUser("admin@example.com", "ADMIN", true);
        regular = seedUser("user@example.com", "USER", true);
        adminToken = tokenService.generateToken(admin);
        userToken = tokenService.generateToken(regular);
    }

    @Test
    void listUsers_asAdmin_returns200WithAllUsers() {
        webTestClient().get()
                .uri("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.totalElements").isEqualTo(2)
                .jsonPath("$.content[?(@.email == 'admin@example.com')]").exists()
                .jsonPath("$.content[?(@.email == 'user@example.com')]").exists();
    }

    @Test
    void listUsers_asNonAdmin_returns403ProblemDetail() {
        webTestClient().get()
                .uri("/api/v1/admin/users")
                .header("Authorization", "Bearer " + userToken)
                .exchange()
                .expectStatus().isForbidden()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Forbidden");
    }

    @Test
    void deactivateUser_asAdmin_returns200InactiveAndPersistsEnabledFalse() {
        UUID targetId = regular.getId();

        webTestClient().patch()
                .uri("/api/v1/admin/users/{userId}/deactivate", targetId)
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(targetId.toString())
                .jsonPath("$.status").isEqualTo("INACTIVE");

        User reloaded = userRepository.findById(targetId).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(reloaded.isEnabled()).isFalse();
    }

    @Test
    void deactivateUser_asNonAdmin_returns403() {
        webTestClient().patch()
                .uri("/api/v1/admin/users/{userId}/deactivate", regular.getId())
                .header("Authorization", "Bearer " + userToken)
                .exchange()
                .expectStatus().isForbidden()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Forbidden");
    }

    @Test
    void deactivateUser_nonExistentId_returns404ProblemDetail() {
        webTestClient().patch()
                .uri("/api/v1/admin/users/{userId}/deactivate", UUID.randomUUID())
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Not Found");
    }
}
