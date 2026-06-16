package com.tsvetanbondzhov.resumeenhancer.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.ChangePasswordRequest;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.SignupRequest;
import org.junit.jupiter.api.BeforeEach;
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
@Import(UserControllerIntegrationTest.ContainersConfig.class)
class UserControllerIntegrationTest {

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

    private WebTestClient webTestClient() {
        return WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .build();
    }

    private String registerAndGetToken(String email, String password) throws Exception {
        SignupRequest signup = new SignupRequest(email, password);
        byte[] responseBody = webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(signup))
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .returnResult()
                .getResponseBody();
        return objectMapper.readTree(responseBody).get("token").asText();
    }

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void changePassword_validRequest_returns204() throws Exception {
        String token = registerAndGetToken("user@example.com", "Password1");

        ChangePasswordRequest request = new ChangePasswordRequest("Password1", "NewPassword1");

        webTestClient().put()
                .uri("/api/v1/users/me/password")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(request))
                .exchange()
                .expectStatus().isNoContent();
    }

    @Test
    void changePassword_wrongCurrentPassword_returns400() throws Exception {
        String token = registerAndGetToken("user2@example.com", "Password1");

        ChangePasswordRequest request = new ChangePasswordRequest("WrongPassword", "NewPassword1");

        webTestClient().put()
                .uri("/api/v1/users/me/password")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(request))
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void changePassword_withoutToken_returns401() throws Exception {
        ChangePasswordRequest request = new ChangePasswordRequest("Password1", "NewPassword1");

        webTestClient().put()
                .uri("/api/v1/users/me/password")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(request))
                .exchange()
                .expectStatus().isUnauthorized();
    }
}
