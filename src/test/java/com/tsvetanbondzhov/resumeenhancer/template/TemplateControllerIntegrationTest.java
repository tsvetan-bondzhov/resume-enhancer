package com.tsvetanbondzhov.resumeenhancer.template;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.TokenService;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
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
import org.springframework.security.crypto.password.PasswordEncoder;
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

    @Autowired
    private TokenService tokenService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private WebTestClient webTestClient() {
        return WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .build();
    }

    /**
     * Seeds a user with the given role directly (signup only yields USER role) and returns a JWT.
     */
    private String seedUserAndGetToken(String email, String role) {
        User u = new User();
        u.setEmail(email);
        u.setRole(role);
        u.setEnabled(true);
        u.setPasswordHash(passwordEncoder.encode("Password1"));
        return tokenService.generateToken(userRepository.save(u));
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

    // ─── GET /{id} resolves the caller's own (unpublished) custom template ───

    @Test
    void getTemplate_byId_returnsOwnCustomTemplate() throws Exception {
        String token = registerAndGetToken("get_own_custom@example.com", "Password1");
        String createBody = """
                { "name": "My Custom", "description": "mine", "templateDefinition": { "layoutType": "single-column" } }
                """;
        String createdId = createCustomTemplateAndGetId(token, createBody);

        // The custom template is unpublished, yet the shared GET-by-id endpoint resolves it
        // for its owner via the unified lookup.
        webTestClient().get()
                .uri("/api/v1/resume-templates/" + createdId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(createdId)
                .jsonPath("$.name").isEqualTo("My Custom")
                .jsonPath("$.isPrebuilt").isEqualTo(false)
                .jsonPath("$.isPublished").isEqualTo(false);
    }

    // ─── GET /{id} for another user's private custom id → 404 (not 403) ──────

    @Test
    void getTemplate_byId_otherUsersPrivateCustom_returns404() throws Exception {
        String tokenA = registerAndGetToken("get_shared_a@example.com", "Password1");
        String tokenB = registerAndGetToken("get_shared_b@example.com", "Password1");
        String createBody = """
                { "name": "A's Custom", "description": null, "templateDefinition": {} }
                """;
        String aTemplateId = createCustomTemplateAndGetId(tokenA, createBody);

        // B requesting A's private custom id via the shared GET endpoint → clean 404,
        // not a 403 (owner-scoped lookup simply misses).
        webTestClient().get()
                .uri("/api/v1/resume-templates/" + aTemplateId)
                .header("Authorization", "Bearer " + tokenB)
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

    // ─── Non-admin 403 on admin list-all and publish/unpublish ───────────────

    @Test
    void listAllTemplates_nonAdmin_returns403() {
        String token = seedUserAndGetToken("listall_403@example.com", "USER");

        webTestClient().get()
                .uri("/api/v1/resume-templates/admin")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void publishTemplate_nonAdmin_returns403() {
        String token = seedUserAndGetToken("publish_403@example.com", "USER");

        webTestClient().patch()
                .uri("/api/v1/resume-templates/11111111-0000-0000-0000-000000000001/publish")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void unpublishTemplate_nonAdmin_returns403() {
        String token = seedUserAndGetToken("unpublish_403@example.com", "USER");

        webTestClient().patch()
                .uri("/api/v1/resume-templates/11111111-0000-0000-0000-000000000001/unpublish")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isForbidden();
    }

    // ─── Admin happy paths: create → list-all → publish → unpublish → delete ──

    @Test
    void adminTemplateLifecycle_create_list_publish_unpublish_delete() throws Exception {
        String adminToken = seedUserAndGetToken("template_admin@example.com", "ADMIN");

        String createBody = """
                { "name": "Draft Template", "description": "A draft", "templateDefinition": { "layoutType": "single-column" } }
                """;

        // Create → 201 with isPrebuilt=true / isPublished=false
        webTestClient().post()
                .uri("/api/v1/resume-templates")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.isPrebuilt").isEqualTo(true)
                .jsonPath("$.isPublished").isEqualTo(false)
                .jsonPath("$.name").isEqualTo("Draft Template");

        // Create a second draft and capture its id for the lifecycle assertions
        String createdId = createTemplateAndGetId(adminToken, createBody);

        // Admin list-all includes the new draft
        String adminList = webTestClient().get()
                .uri("/api/v1/resume-templates/admin")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        var adminArray = objectMapper.readTree(adminList);
        assertThat(adminArray.isArray()).isTrue();
        assertThat(idsOf(adminArray)).contains(createdId);

        // Public list does NOT include the unpublished draft
        String publicList = webTestClient().get()
                .uri("/api/v1/resume-templates")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertThat(idsOf(objectMapper.readTree(publicList))).doesNotContain(createdId);

        // Publish → 200, then it appears in public list (cache evicted)
        webTestClient().patch()
                .uri("/api/v1/resume-templates/" + createdId + "/publish")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.isPublished").isEqualTo(true);

        String publicAfterPublish = webTestClient().get()
                .uri("/api/v1/resume-templates")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertThat(idsOf(objectMapper.readTree(publicAfterPublish))).contains(createdId);

        // Unpublish → 200, then it disappears from public list
        webTestClient().patch()
                .uri("/api/v1/resume-templates/" + createdId + "/unpublish")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.isPublished").isEqualTo(false);

        String publicAfterUnpublish = webTestClient().get()
                .uri("/api/v1/resume-templates")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertThat(idsOf(objectMapper.readTree(publicAfterUnpublish))).doesNotContain(createdId);

        // Delete → 204, then admin list no longer returns it
        webTestClient().delete()
                .uri("/api/v1/resume-templates/" + createdId)
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isNoContent();

        String adminAfterDelete = webTestClient().get()
                .uri("/api/v1/resume-templates/admin")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertThat(idsOf(objectMapper.readTree(adminAfterDelete))).doesNotContain(createdId);
    }

    // ─── Admin updates a SYSTEM template's definition via PUT /{id} ───────────

    @Test
    void putTemplate_asAdmin_updatesSystemTemplateDefinition() throws Exception {
        String adminToken = seedUserAndGetToken("put_def_admin@example.com", "ADMIN");

        String createBody = """
                { "name": "System Template", "description": "orig", "templateDefinition": { "layoutType": "single-column" } }
                """;
        String createdId = createTemplateAndGetId(adminToken, createBody);

        // Admin updates the definition (and name) → 200 with the new definition persisted
        String updateBody = """
                { "name": "System Template v2", "description": "edited",
                  "templateDefinition": { "layoutType": "two-column", "cssVariables": { "--accent-color": "#123456" } } }
                """;
        webTestClient().put()
                .uri("/api/v1/resume-templates/" + createdId)
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(updateBody)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo("System Template v2")
                .jsonPath("$.isPrebuilt").isEqualTo(true)
                .jsonPath("$.templateDefinition.layoutType").isEqualTo("two-column")
                .jsonPath("$.templateDefinition.cssVariables.--accent-color").isEqualTo("#123456");
    }

    @Test
    void deleteTemplate_unknownId_asAdmin_returns404() {
        String adminToken = seedUserAndGetToken("delete_404_admin@example.com", "ADMIN");

        webTestClient().delete()
                .uri("/api/v1/resume-templates/00000000-0000-0000-0000-000000000000")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Not Found");
    }

    // ─── Custom templates (Story 8.1) ────────────────────────────────────────

    @Test
    void customTemplateLifecycle_create_list_update_delete() throws Exception {
        String token = registerAndGetToken("custom_lifecycle@example.com", "Password1");

        String createBody = """
                { "name": "My Custom", "description": "mine", "templateDefinition": { "layoutType": "single-column" } }
                """;

        // Create → 201 with ownerId-scoped, isPrebuilt=false / isPublished=false
        webTestClient().post()
                .uri("/api/v1/resume-templates/custom")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.name").isEqualTo("My Custom")
                .jsonPath("$.isPrebuilt").isEqualTo(false)
                .jsonPath("$.isPublished").isEqualTo(false);

        // Create a second custom template and capture its id for lifecycle assertions
        String createdId = createCustomTemplateAndGetId(token, createBody);

        // List own → contains the created template
        String listBody = webTestClient().get()
                .uri("/api/v1/resume-templates/custom")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertThat(idsOf(objectMapper.readTree(listBody))).contains(createdId);

        // Update own → 200 with new name
        String updateBody = """
                { "name": "My Custom Renamed", "description": "edited", "templateDefinition": {} }
                """;
        webTestClient().put()
                .uri("/api/v1/resume-templates/custom/" + createdId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(updateBody)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo("My Custom Renamed");

        // Delete own → 204, then it is gone from the list
        webTestClient().delete()
                .uri("/api/v1/resume-templates/custom/" + createdId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNoContent();

        String listAfterDelete = webTestClient().get()
                .uri("/api/v1/resume-templates/custom")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertThat(idsOf(objectMapper.readTree(listAfterDelete))).doesNotContain(createdId);
    }

    @Test
    void customTemplate_crossUserOwnership_returns403() throws Exception {
        String tokenA = registerAndGetToken("owner_a@example.com", "Password1");
        String tokenB = registerAndGetToken("owner_b@example.com", "Password1");

        String createBody = """
                { "name": "A's Template", "description": null, "templateDefinition": {} }
                """;
        String aTemplateId = createCustomTemplateAndGetId(tokenA, createBody);

        // User B cannot PUT user A's custom template → 403
        String updateBody = """
                { "name": "Hijacked", "description": null, "templateDefinition": {} }
                """;
        webTestClient().put()
                .uri("/api/v1/resume-templates/custom/" + aTemplateId)
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(updateBody)
                .exchange()
                .expectStatus().isForbidden()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Forbidden");

        // User B cannot DELETE user A's custom template → 403
        webTestClient().delete()
                .uri("/api/v1/resume-templates/custom/" + aTemplateId)
                .header("Authorization", "Bearer " + tokenB)
                .exchange()
                .expectStatus().isForbidden()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Forbidden");

        // B's list does not include A's template
        String bList = webTestClient().get()
                .uri("/api/v1/resume-templates/custom")
                .header("Authorization", "Bearer " + tokenB)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertThat(idsOf(objectMapper.readTree(bList))).doesNotContain(aTemplateId);
    }

    @Test
    void customTemplate_unknownId_returns404() throws Exception {
        String token = registerAndGetToken("custom_404@example.com", "Password1");

        String updateBody = """
                { "name": "X", "description": null, "templateDefinition": {} }
                """;
        webTestClient().put()
                .uri("/api/v1/resume-templates/custom/00000000-0000-0000-0000-000000000000")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(updateBody)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Not Found");
    }

    @Test
    void customTemplate_prebuiltTemplate_returns403() throws Exception {
        String token = registerAndGetToken("custom_prebuilt_403@example.com", "Password1");

        String updateBody = """
                { "name": "X", "description": null, "templateDefinition": {} }
                """;
        // Seeded prebuilt template (owner_id NULL) → exists but not the caller's → 403, not 404
        webTestClient().put()
                .uri("/api/v1/resume-templates/custom/11111111-0000-0000-0000-000000000001")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(updateBody)
                .exchange()
                .expectStatus().isForbidden()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Forbidden");
    }

    @Test
    void customTemplate_unauthenticated_returns401() {
        webTestClient().get()
                .uri("/api/v1/resume-templates/custom")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void getCustomTemplate_owner_returns200() throws Exception {
        String token = registerAndGetToken("get_custom_owner@example.com", "Password1");
        String createBody = """
                { "name": "Editable", "description": "mine", "templateDefinition": { "layoutType": "single-column" } }
                """;
        String createdId = createCustomTemplateAndGetId(token, createBody);

        webTestClient().get()
                .uri("/api/v1/resume-templates/custom/" + createdId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(createdId)
                .jsonPath("$.name").isEqualTo("Editable")
                .jsonPath("$.isPrebuilt").isEqualTo(false);
    }

    @Test
    void getCustomTemplate_otherUsersTemplate_returns403() throws Exception {
        String tokenA = registerAndGetToken("get_custom_a@example.com", "Password1");
        String tokenB = registerAndGetToken("get_custom_b@example.com", "Password1");
        String createBody = """
                { "name": "A's Template", "description": null, "templateDefinition": {} }
                """;
        String aTemplateId = createCustomTemplateAndGetId(tokenA, createBody);

        webTestClient().get()
                .uri("/api/v1/resume-templates/custom/" + aTemplateId)
                .header("Authorization", "Bearer " + tokenB)
                .exchange()
                .expectStatus().isForbidden()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Forbidden");
    }

    @Test
    void getCustomTemplate_unknownId_returns404() throws Exception {
        String token = registerAndGetToken("get_custom_404@example.com", "Password1");

        webTestClient().get()
                .uri("/api/v1/resume-templates/custom/00000000-0000-0000-0000-000000000000")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Not Found");
    }

    @Test
    void getCustomTemplate_unauthenticated_returns401() {
        webTestClient().get()
                .uri("/api/v1/resume-templates/custom/00000000-0000-0000-0000-000000000000")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    // ─── Admin list-all custom templates includes owner email ───────────────

    @Test
    void listAllCustomTemplates_nonAdmin_returns403() {
        String token = seedUserAndGetToken("listallcustom_403@example.com", "USER");

        webTestClient().get()
                .uri("/api/v1/resume-templates/admin/custom")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void listAllCustomTemplates_asAdmin_includesOwnerEmail() throws Exception {
        String ownerEmail = "custom_owner_listed@example.com";
        String ownerToken = registerAndGetToken(ownerEmail, "Password1");
        String adminToken = seedUserAndGetToken("custom_list_admin@example.com", "ADMIN");

        String createBody = """
                { "name": "Owned Template", "description": "owned", "templateDefinition": { "layoutType": "single-column" } }
                """;
        String createdId = createCustomTemplateAndGetId(ownerToken, createBody);

        String body = webTestClient().get()
                .uri("/api/v1/resume-templates/admin/custom")
                .header("Authorization", "Bearer " + adminToken)
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        var array = objectMapper.readTree(body);
        assertThat(array.isArray()).isTrue();
        assertThat(idsOf(array)).contains(createdId);
        boolean found = false;
        for (var node : array) {
            if (createdId.equals(node.get("id").asText())) {
                assertThat(node.get("ownerEmail").asText()).isEqualTo(ownerEmail);
                assertThat(node.get("isPrebuilt").asBoolean()).isFalse();
                found = true;
            }
        }
        assertThat(found).isTrue();
    }

    private String createCustomTemplateAndGetId(String token, String createBody) throws Exception {
        String body = webTestClient().post()
                .uri("/api/v1/resume-templates/custom")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        return objectMapper.readTree(body).get("id").asText();
    }

    private String createTemplateAndGetId(String adminToken, String createBody) throws Exception {
        String body = webTestClient().post()
                .uri("/api/v1/resume-templates")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(createBody)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        return objectMapper.readTree(body).get("id").asText();
    }

    private java.util.List<String> idsOf(com.fasterxml.jackson.databind.JsonNode array) {
        java.util.List<String> ids = new java.util.ArrayList<>();
        array.forEach(node -> ids.add(node.get("id").asText()));
        return ids;
    }
}
