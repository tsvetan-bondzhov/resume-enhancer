package com.tsvetanbondzhov.resumeenhancer.template;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(webEnvironment = RANDOM_PORT)
@ActiveProfiles("test")
@Import(TemplateControllerIntegrationTest.ContainersConfig.class)
class TemplateControllerIntegrationTest {

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

    /**
     * Registers a new user via the signup endpoint and returns the JWT token.
     */
    private String registerAndGetToken(String email, String password) throws Exception {
        SignupRequest signup = new SignupRequest(email, password);
        String responseBody = webTestClient().post()
                .uri("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(objectMapper.writeValueAsString(signup))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        return objectMapper.readTree(responseBody).get("token").asText();
    }

    // ─── GET /api/v1/resume-templates → 200 with seeded templates ────────────

    @Test
    void listTemplates_authenticated_returnsPublishedTemplates() throws Exception {
        String token = registerAndGetToken("list_templates@example.com", "Password1");

        String responseBody = webTestClient().get()
                .uri("/api/v1/resume-templates")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        var templateList = objectMapper.readTree(responseBody);
        assertThat(templateList.isArray()).isTrue();
        assertThat(templateList.size()).isGreaterThanOrEqualTo(3);
        assertThat(templateList.get(0).has("name")).isTrue();
        assertThat(templateList.get(0).get("isPrebuilt").asBoolean()).isTrue();
        assertThat(templateList.get(0).get("isPublished").asBoolean()).isTrue();
    }

    // ─── GET /api/v1/resume-templates → 401 without token ────────────────────

    @Test
    void listTemplates_unauthenticated_returns401() {
        webTestClient().get()
                .uri("/api/v1/resume-templates")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    // ─── GET /api/v1/resume-templates/{id} → 200 with seeded id ──────────────

    @Test
    void getTemplate_byId_returns200() throws Exception {
        String token = registerAndGetToken("get_template@example.com", "Password1");

        webTestClient().get()
                .uri("/api/v1/resume-templates/11111111-0000-0000-0000-000000000001")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo("11111111-0000-0000-0000-000000000001")
                .jsonPath("$.name").isEqualTo("Minimal")
                .jsonPath("$.isPrebuilt").isEqualTo(true);
    }

    // ─── GET /api/v1/resume-templates/{id} → 404 for unknown id ─────────────

    @Test
    void getTemplate_unknownId_returns404() throws Exception {
        String token = registerAndGetToken("get_template_404@example.com", "Password1");

        webTestClient().get()
                .uri("/api/v1/resume-templates/00000000-0000-0000-0000-000000000000")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Not Found");
    }

    // ─── POST /api/v1/resume-templates → 403 for non-admin ───────────────────

    @Test
    void postTemplate_nonAdmin_returns403() throws Exception {
        String token = registerAndGetToken("post_template_403@example.com", "Password1");

        String body = """
                { "name": "Test", "description": null, "templateDefinition": {} }
                """;

        webTestClient().post()
                .uri("/api/v1/resume-templates")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .exchange()
                .expectStatus().isForbidden();
    }

    // ─── PUT /api/v1/resume-templates/{id} → 403 for non-admin ──────────────

    @Test
    void putTemplate_nonAdmin_returns403() throws Exception {
        String token = registerAndGetToken("put_template_403@example.com", "Password1");

        String body = """
                { "name": "Updated", "description": null, "templateDefinition": {} }
                """;

        webTestClient().put()
                .uri("/api/v1/resume-templates/11111111-0000-0000-0000-000000000001")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .exchange()
                .expectStatus().isForbidden();
    }

    // ─── DELETE /api/v1/resume-templates/{id} → 403 for non-admin ────────────

    @Test
    void deleteTemplate_nonAdmin_returns403() throws Exception {
        String token = registerAndGetToken("delete_template_403@example.com", "Password1");

        webTestClient().delete()
                .uri("/api/v1/resume-templates/11111111-0000-0000-0000-000000000001")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isForbidden();
    }
}
