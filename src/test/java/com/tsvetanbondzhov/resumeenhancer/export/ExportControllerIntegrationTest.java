package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.SignupRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeRepository;
import com.tsvetanbondzhov.resumeenhancer.template.TemplateRepository;
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

/**
 * Integration tests for {@link ExportController}.
 * <p>
 * Uses an isolated PostgreSQL Testcontainer — no Ollama or Grafana required
 * because export has no AI dependency (AC2, AC6).
 */
@SpringBootTest(webEnvironment = RANDOM_PORT)
@ActiveProfiles("test")
@Import(ExportControllerIntegrationTest.ContainersConfig.class)
class ExportControllerIntegrationTest {

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

    @Autowired
    private TemplateRepository templateRepository;

    @BeforeEach
    void cleanDb() {
        resumeRepository.deleteAll();
        userRepository.deleteAll();
        templateRepository.deleteAll();
    }

    private WebTestClient webTestClient() {
        return WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .build();
    }

    /**
     * Registers a new user and returns the JWT token.
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

    /**
     * Creates a resume for the authenticated user and returns its UUID string.
     */
    private String createResume(String token, String name) throws Exception {
        String body = """
                { "name": "%s", "templateId": null }
                """.formatted(name);
        String responseBody = webTestClient().post()
                .uri("/api/v1/resumes")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        return objectMapper.readTree(responseBody).get("id").asText();
    }

    // ─── Test 1: Happy path PDF export ───────────────────────────────────────

    @Test
    void get_exportResume_pdf_returns200WithPdfContent() throws Exception {
        String token = registerAndGetToken("export_happy@example.com", "Password1");
        String resumeId = createResume(token, "My Test Resume");

        webTestClient()
                .get()
                .uri("/api/v1/resumes/" + resumeId + "/export?format=pdf")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueMatches("Content-Type", "application/pdf.*")
                .expectHeader().valueMatches("Content-Disposition", "attachment; filename=\".*\\.pdf\"")
                .expectBody(byte[].class)
                .value(bytes -> {
                    assert bytes != null && bytes.length > 0 : "PDF bytes must be non-empty";
                });
    }

    // ─── Test 2: Unauthenticated request → 401 ────────────────────────────────

    @Test
    void get_exportResume_noToken_returns401() throws Exception {
        String token = registerAndGetToken("export_unauth@example.com", "Password1");
        String resumeId = createResume(token, "Secure Resume");

        webTestClient()
                .get()
                .uri("/api/v1/resumes/" + resumeId + "/export?format=pdf")
                // No Authorization header
                .exchange()
                .expectStatus().isUnauthorized();
    }

    // ─── Test 3: Resume owned by another user → 403 ──────────────────────────

    @Test
    void get_exportResume_otherUsersResume_returns403() throws Exception {
        String tokenA = registerAndGetToken("export_ownerA@example.com", "Password1");
        String tokenB = registerAndGetToken("export_ownerB@example.com", "Password1");

        String resumeAId = createResume(tokenA, "User A Resume");

        // User B tries to export User A's resume
        webTestClient()
                .get()
                .uri("/api/v1/resumes/" + resumeAId + "/export?format=pdf")
                .header("Authorization", "Bearer " + tokenB)
                .exchange()
                .expectStatus().isForbidden();
    }

    // ─── Test 5: Happy path DOCX export ──────────────────────────────────────

    @Test
    void get_exportResume_docx_returns200WithDocxContent() throws Exception {
        String token = registerAndGetToken("export_docx@example.com", "Password1");
        String resumeId = createResume(token, "My DOCX Resume");

        webTestClient()
                .get()
                .uri("/api/v1/resumes/" + resumeId + "/export?format=docx")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueMatches("Content-Type",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document.*")
                .expectHeader().valueMatches("Content-Disposition", "attachment; filename=\".*\\.docx\"")
                .expectBody(byte[].class)
                .value(bytes -> assertThat(bytes).isNotNull().isNotEmpty());
    }

    // ─── Test 6: Visual DOCX export ──────────────────────────────────────────

    @Test
    void get_exportResume_docxVisualMode_returns200WithDocxContent() throws Exception {
        String token = registerAndGetToken("export_visual@example.com", "Password1");
        String resumeId = createResume(token, "My Visual Resume");

        webTestClient()
                .get()
                .uri("/api/v1/resumes/" + resumeId + "/export?format=docx&mode=visual")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueMatches("Content-Type",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document.*")
                .expectBody(byte[].class)
                .value(bytes -> assertThat(bytes).isNotNull().isNotEmpty());
    }

    // ─── Test 7: Visual PDF is rejected → 400 ────────────────────────────────

    @Test
    void get_exportResume_pdfVisualMode_returns400() throws Exception {
        String token = registerAndGetToken("export_visualpdf@example.com", "Password1");
        String resumeId = createResume(token, "Visual PDF Resume");

        webTestClient()
                .get()
                .uri("/api/v1/resumes/" + resumeId + "/export?format=pdf&mode=visual")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isBadRequest();
    }

    // ─── Test 8: Invalid mode → 400 ──────────────────────────────────────────

    @Test
    void get_exportResume_invalidMode_returns400() throws Exception {
        String token = registerAndGetToken("export_badmode@example.com", "Password1");
        String resumeId = createResume(token, "Bad Mode Resume");

        webTestClient()
                .get()
                .uri("/api/v1/resumes/" + resumeId + "/export?format=docx&mode=bogus")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isBadRequest();
    }

    // ─── Test 4: Unsupported format → 400 ProblemDetail ──────────────────────

    @Test
    void get_exportResume_unsupportedFormat_returns400() throws Exception {
        String token = registerAndGetToken("export_fmt@example.com", "Password1");
        String resumeId = createResume(token, "Format Test Resume");

        webTestClient()
                .get()
                .uri("/api/v1/resumes/" + resumeId + "/export?format=txt")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.detail").value((String detail) -> {
                    assert detail != null && detail.toLowerCase().contains("unsupported") :
                            "detail must mention 'unsupported', got: " + detail;
                });
    }
}
