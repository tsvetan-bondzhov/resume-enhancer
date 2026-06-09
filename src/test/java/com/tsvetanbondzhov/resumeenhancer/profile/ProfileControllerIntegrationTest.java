package com.tsvetanbondzhov.resumeenhancer.profile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.SignupRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.repository.ProfileRepository;
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
@Import(ProfileControllerIntegrationTest.ContainersConfig.class)
class ProfileControllerIntegrationTest {

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
    private ProfileRepository profileRepository;

    @BeforeEach
    void cleanDb() {
        profileRepository.deleteAll();
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

    // ─── AC2: GET with no saved profile → 200 empty ──────────────────────────

    @Test
    void getProfile_noSavedProfile_returns200WithEmptyDto() throws Exception {
        String token = registerAndGetToken("get_empty@example.com", "Password1");

        webTestClient().get()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.summary").isEmpty()
                .jsonPath("$.workExperiences").isArray()
                .jsonPath("$.workExperiences.length()").isEqualTo(0)
                .jsonPath("$.education").isArray()
                .jsonPath("$.education.length()").isEqualTo(0)
                .jsonPath("$.skills").isArray()
                .jsonPath("$.skills.length()").isEqualTo(0);
    }

    // ─── AC3: PUT valid payload → 200, persisted, GET echoes it ─────────────

    @Test
    void putProfile_validPayload_returns200AndPersists() throws Exception {
        String token = registerAndGetToken("put_valid@example.com", "Password1");

        String body = """
                {
                  "summary": "Experienced Java developer",
                  "workExperiences": [
                    {
                      "jobTitle": "Software Engineer",
                      "company": "Acme Corp",
                      "startDate": "2020-01-01",
                      "endDate": null,
                      "isCurrent": true,
                      "description": "Built microservices"
                    }
                  ],
                  "education": [
                    {
                      "institution": "Tech University",
                      "degree": "BSc",
                      "fieldOfStudy": "Computer Science",
                      "startDate": "2016-09-01",
                      "endDate": "2020-06-01"
                    }
                  ],
                  "skills": [
                    { "name": "Java" },
                    { "name": "Spring Boot" }
                  ]
                }
                """;

        webTestClient().put()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.summary").isEqualTo("Experienced Java developer")
                .jsonPath("$.workExperiences[0].jobTitle").isEqualTo("Software Engineer")
                .jsonPath("$.workExperiences[0].isCurrent").isEqualTo(true)
                .jsonPath("$.education[0].institution").isEqualTo("Tech University")
                .jsonPath("$.skills.length()").isEqualTo(2);

        // Follow-up GET returns persisted data
        webTestClient().get()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.summary").isEqualTo("Experienced Java developer")
                .jsonPath("$.workExperiences[0].jobTitle").isEqualTo("Software Engineer")
                .jsonPath("$.skills.length()").isEqualTo(2);
    }

    // ─── AC4: PUT with blank jobTitle → 400 ProblemDetail with errors ────────

    @Test
    void putProfile_workExperienceBlankJobTitle_returns400WithErrors() throws Exception {
        String token = registerAndGetToken("put_invalid@example.com", "Password1");

        String body = """
                {
                  "summary": null,
                  "workExperiences": [
                    {
                      "jobTitle": "",
                      "company": "Acme",
                      "startDate": null,
                      "endDate": null,
                      "isCurrent": false,
                      "description": null
                    }
                  ],
                  "education": [],
                  "skills": []
                }
                """;

        webTestClient().put()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.title").isEqualTo("Bad Request")
                .jsonPath("$.errors").exists();
    }

    // ─── AC5: Per-user isolation ──────────────────────────────────────────────

    @Test
    void getProfile_userIsolation_cannotSeeOtherUsersProfile() throws Exception {
        String tokenA = registerAndGetToken("user_a@example.com", "Password1");
        String tokenB = registerAndGetToken("user_b@example.com", "Password1");

        // User A saves a profile
        String bodyA = """
                {
                  "summary": "User A summary",
                  "workExperiences": [],
                  "education": [],
                  "skills": [{ "name": "Skill-A" }]
                }
                """;

        webTestClient().put()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(bodyA)
                .exchange()
                .expectStatus().isOk();

        // User B's GET returns an empty profile, not A's data
        webTestClient().get()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + tokenB)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.summary").isEmpty()
                .jsonPath("$.skills.length()").isEqualTo(0);
    }

    // ─── no token → 401 ──────────────────────────────────────────────────────

    @Test
    void getProfile_noToken_returns401() {
        webTestClient().get()
                .uri("/api/v1/profile")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    // ─── AC9: round-trip for all four new extended sections ──────────────────

    @Test
    void updateProfile_withAllNewSections_roundTripsCorrectly() throws Exception {
        String token = registerAndGetToken("extended_sections@example.com", "Password1");

        String requestBody = """
                {
                  "summary": "Extended profile test",
                  "workExperiences": [],
                  "education": [],
                  "skills": [],
                  "certifications": [
                    {"name": "AWS Cloud Practitioner", "issuer": "Amazon", "issueDate": "2023-01-15", "expirationDate": null}
                  ],
                  "languages": [
                    {"name": "English", "proficiencyLevel": "NATIVE"},
                    {"name": "Spanish", "proficiencyLevel": "INTERMEDIATE"}
                  ],
                  "projects": [
                    {"name": "ResumeApp", "description": "A resume enhancer", "technologies": "Java, React", "link": "https://github.com/test", "startDate": "2024-01-01", "endDate": null, "isCurrent": true}
                  ],
                  "volunteering": [
                    {"role": "Mentor", "organization": "Code.org", "description": "Teaching programming", "startDate": null, "endDate": null, "isCurrent": false}
                  ]
                }
                """;

        // PUT — verify response body
        webTestClient().put()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.certifications[0].name").isEqualTo("AWS Cloud Practitioner")
                .jsonPath("$.languages[0].name").isEqualTo("English")
                .jsonPath("$.languages[0].proficiencyLevel").isEqualTo("NATIVE")
                .jsonPath("$.projects[0].name").isEqualTo("ResumeApp")
                .jsonPath("$.volunteering[0].role").isEqualTo("Mentor");

        // GET — verify persistence
        webTestClient().get()
                .uri("/api/v1/profile")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.certifications[0].name").isEqualTo("AWS Cloud Practitioner")
                .jsonPath("$.languages[1].name").isEqualTo("Spanish")
                .jsonPath("$.projects[0].isCurrent").isEqualTo(true)
                .jsonPath("$.volunteering[0].organization").isEqualTo("Code.org");
    }
}
