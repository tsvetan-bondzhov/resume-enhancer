package com.tsvetanbondzhov.resumeenhancer.resume;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(webEnvironment = RANDOM_PORT)
@ActiveProfiles("test")
@Import(ResumeControllerIntegrationTest.ContainersConfig.class)
class ResumeControllerIntegrationTest {

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
    private ResumeRepository resumeRepository;

    @BeforeEach
    void cleanDb() {
        resumeRepository.deleteAll();
        userRepository.deleteAll();
    }

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

    // ─── POST /api/v1/resumes → 201 ──────────────────────────────────────────

    @Test
    void post_createResume_returns201WithResumeDto() throws Exception {
        String token = registerAndGetToken("create_resume@example.com", "Password1");

        String body = """
                {
                  "name": "My Test Resume",
                  "templateId": null
                }
                """;

        webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.id").isNotEmpty()
                .jsonPath("$.name").isEqualTo("My Test Resume")
                .jsonPath("$.isTailored").isEqualTo(false)
                .jsonPath("$.content").exists()
                .jsonPath("$.content.sections").isArray();
    }

    // ─── GET /api/v1/resumes → only own resumes returned ─────────────────────

    @Test
    void get_listResumes_returnsOnlyOwnResumes() throws Exception {
        String tokenA = registerAndGetToken("list_a@example.com", "Password1");
        String tokenB = registerAndGetToken("list_b@example.com", "Password1");

        // User A creates a resume
        String bodyA = """
                { "name": "Resume A", "templateId": null }
                """;
        webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(bodyA)
                .exchange()
                .expectStatus().isCreated();

        // User B creates a resume
        String bodyB = """
                { "name": "Resume B", "templateId": null }
                """;
        webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(bodyB)
                .exchange()
                .expectStatus().isCreated();

        // User A's list returns only their resume
        webTestClient().get()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + tokenA)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].name").isEqualTo("Resume A");
    }

    // ─── GET /api/v1/resumes/{id} → 403 for other user's resume ──────────────

    @Test
    void get_resumeById_otherUsersResume_returns403() throws Exception {
        String tokenA = registerAndGetToken("owner_403@example.com", "Password1");
        String tokenB = registerAndGetToken("other_403@example.com", "Password1");

        // User A creates a resume
        String createBody = """
                { "name": "Owner's Resume", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String resumeId = objectMapper.readTree(createResponse).get("id").asText();

        // User B tries to access User A's resume → 403
        webTestClient().get()
                .uri("/api/v1/resumes/" + resumeId)
                .header("Authorization", "Bearer " + tokenB)
                .exchange()
                .expectStatus().isForbidden()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Forbidden");
    }

    // ─── DELETE /api/v1/resumes/{id} → 204 ───────────────────────────────────

    @Test
    void delete_ownResume_returns204() throws Exception {
        String token = registerAndGetToken("delete_resume@example.com", "Password1");

        // Create a resume
        String createBody = """
                { "name": "To Be Deleted", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String resumeId = objectMapper.readTree(createResponse).get("id").asText();

        // Delete it
        webTestClient().delete()
                .uri("/api/v1/resumes/" + resumeId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNoContent();

        // Verify gone — GET returns 403 (empty Optional → access denied)
        webTestClient().get()
                .uri("/api/v1/resumes/" + resumeId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isForbidden();
    }

    // ─── POST /api/v1/resumes/{id}/clone → 201 with new id ───────────────────

    @Test
    void post_cloneResume_returns201WithNewId() throws Exception {
        String token = registerAndGetToken("clone_resume@example.com", "Password1");

        // Create original
        String createBody = """
                { "name": "Original Resume", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String originalId = objectMapper.readTree(createResponse).get("id").asText();

        // Clone it
        String cloneBody = """
                { "name": "Cloned Resume" }
                """;
        String cloneResponse = webTestClient().post()
                .uri("/api/v1/resumes/" + originalId + "/clone")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(cloneBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String clonedId = objectMapper.readTree(cloneResponse).get("id").asText();
        String clonedName = objectMapper.readTree(cloneResponse).get("name").asText();

        // New id differs from original
        assertThat(clonedId).as("Clone must have a different ID").isNotEqualTo(originalId);
        assertThat(clonedName).as("Clone name must match SaveAsRequest").isEqualTo("Cloned Resume");

        // Both resumes exist in list
        webTestClient().get()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(2);
    }

    // ─── No token → 401 ───────────────────────────────────────────────────────

    @Test
    void get_listResumes_noToken_returns401() {
        webTestClient().get()
                .uri("/api/v1/resumes")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    // --- PUT /api/v1/resumes/{id} ------------------------------------------

    @Test
    void put_updateResume_returns200WithUpdatedContent() throws Exception {
        String token = registerAndGetToken("update_resume@example.com", "Password1");

        // Create a resume
        String createBody = """
                { "name": "Original Name", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String resumeId = objectMapper.readTree(createResponse).get("id").asText();
        // Capture original updatedAt before the PUT
        String originalUpdatedAt = objectMapper.readTree(createResponse).get("updatedAt").asText();

        // PUT with updated name and content
        String putBody = """
                {
                  "name": "Updated Name",
                  "content": { "sections": [] }
                }
                """;
        String putResponse = webTestClient().put()
                .uri("/api/v1/resumes/" + resumeId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(putBody)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        // Assert updatedAt changed and is a valid recent timestamp
        String newUpdatedAt = objectMapper.readTree(putResponse).get("updatedAt").asText();
        assertThat(newUpdatedAt).isNotEmpty();
        assertThat(newUpdatedAt).isNotEqualTo(originalUpdatedAt);
        java.time.Instant parsed = java.time.Instant.parse(newUpdatedAt);
        assertThat(parsed).isAfter(java.time.Instant.parse("2025-01-01T00:00:00Z"));

        // Also verify response fields
        assertThat(objectMapper.readTree(putResponse).get("name").asText()).isEqualTo("Updated Name");
        assertThat(objectMapper.readTree(putResponse).get("id").asText()).isEqualTo(resumeId);
        assertThat(objectMapper.readTree(putResponse).get("content").get("sections").isArray()).isTrue();
    }

    @Test
    void put_updateResume_otherUsersResume_returns403() throws Exception {
        String tokenA = registerAndGetToken("put_owner@example.com", "Password1");
        String tokenB = registerAndGetToken("put_other@example.com", "Password1");

        // User A creates a resume
        String createBody = """
                { "name": "Owner Resume", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String resumeId = objectMapper.readTree(createResponse).get("id").asText();

        // User B tries to update User A's resume
        String putBody = """
                {
                  "name": "Hijacked Name",
                  "content": { "sections": [] }
                }
                """;
        webTestClient().put()
                .uri("/api/v1/resumes/" + resumeId)
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(putBody)
                .exchange()
                .expectStatus().isForbidden();
    }

    // ─── GET /api/v1/resumes/{id} → 200 for own resume ──────────────────────

    @Test
    void get_resumeById_ownResume_returns200() throws Exception {
        String token = registerAndGetToken("get_own@example.com", "Password1");

        String createBody = """
                { "name": "Own Resume", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String resumeId = objectMapper.readTree(createResponse).get("id").asText();

        webTestClient().get()
                .uri("/api/v1/resumes/" + resumeId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(resumeId)
                .jsonPath("$.name").isEqualTo("Own Resume");
    }

    // ─── PATCH /api/v1/resumes/{id}/tailor → 200 ─────────────────────────────

    @Test
    void patch_markAsTailored_returns200WithIsTailoredTrue() throws Exception {
        String token = registerAndGetToken("tailor_resume@example.com", "Password1");

        String createBody = """
                { "name": "Resume To Tailor", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String resumeId = objectMapper.readTree(createResponse).get("id").asText();

        webTestClient().patch()
                .uri("/api/v1/resumes/" + resumeId + "/tailor")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(resumeId)
                .jsonPath("$.isTailored").isEqualTo(true);
    }

    @Test
    void patch_markAsTailored_otherUsersResume_returns403() throws Exception {
        String tokenA = registerAndGetToken("tailor_ownerA@example.com", "Password1");
        String tokenB = registerAndGetToken("tailor_ownerB@example.com", "Password1");

        String createBody = """
                { "name": "Owner Resume", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String resumeId = objectMapper.readTree(createResponse).get("id").asText();

        webTestClient().patch()
                .uri("/api/v1/resumes/" + resumeId + "/tailor")
                .header("Authorization", "Bearer " + tokenB)
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void put_updateResume_blankName_returns400() throws Exception {
        String token = registerAndGetToken("put_invalid@example.com", "Password1");

        // Create a resume first
        String createBody = """
                { "name": "Original", "templateId": null }
                """;
        String createResponse = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        String resumeId = objectMapper.readTree(createResponse).get("id").asText();

        // PUT with blank name
        String putBody = """
                {
                  "name": "",
                  "content": { "sections": [] }
                }
                """;
        webTestClient().put()
                .uri("/api/v1/resumes/" + resumeId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(putBody)
                .exchange()
                .expectStatus().isBadRequest();
    }
}
