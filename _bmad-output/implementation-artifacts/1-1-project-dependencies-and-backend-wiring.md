# Story 1.1: Project Dependencies & Backend Wiring

Status: ready-for-dev

## Story

As a developer,
I want all required backend dependencies added to `pom.xml` and the Spring Boot application configured to start cleanly with Docker Compose services,
so that subsequent stories have a working, compilable foundation to build on.

## Acceptance Criteria

1. **Given** the project skeleton exists with Spring Boot 4.0.6 and Spring AI 2.0.0-M6 **When** `./mvnw spring-boot:run` is executed with `docker compose up` running **Then** the application starts without errors and connects to PostgreSQL and Ollama.

2. **Given** the `pom.xml` is updated **When** the build compiles **Then** `spring-boot-starter-security`, `jjwt-api/impl/jackson` (0.12.x), `poi-ooxml`, `pdfbox`, `itext7-core`, `springdoc-openapi-starter-webmvc-ui` 3.0.3, Caffeine, and `frontend-maven-plugin` are all present with explicit versions.

3. **Given** Spring AI dependencies are declared **When** any Spring AI artifact version is checked **Then** all Spring AI artifact versions are pinned explicitly in `pom.xml` properties — no BOM-only version resolution.

4. **Given** the application starts in the `dev` profile **When** `/swagger-ui.html` is accessed **Then** the Swagger UI is accessible; when started in `prod` profile, it returns 404.

5. **Given** the application starts **When** Flyway runs **Then** V1–V4 migrations execute cleanly on the PostgreSQL instance (tables: `users`, `profiles`/`profile_work_experiences`/`profile_education`/`profile_skills`, `resumes`, `resume_templates`).

6. **Given** the application is configured **When** it starts in `dev` profile **Then** `application-dev.yml` enables Swagger (`springdoc.api-docs.enabled=true`); `application-prod.yml` sets `springdoc.api-docs.enabled=false`.

7. **Given** `compose.yaml` is reviewed **When** the app starts **Then** the `app.jwt.secret` and `app.jwt.expiration-ms` properties are resolvable from `application.yml` (not hardcoded).

## Tasks / Subtasks

- [ ] Task 1: Add all missing dependencies to `pom.xml` (AC: 2, 3)
  - [ ] Add `spring-boot-starter-security` (Boot-managed version)
  - [ ] Add `jjwt-api`, `jjwt-impl`, `jjwt-jackson` at version `0.12.3` (io.jsonwebtoken) with explicit `<jjwt.version>0.12.3</jjwt.version>` property
  - [ ] Add `poi-ooxml` (org.apache.poi) with explicit `<poi.version>5.3.0</poi.version>` property
  - [ ] Add `pdfbox` (org.apache.pdfbox) with explicit `<pdfbox.version>3.0.3</pdfbox.version>` property
  - [ ] Add `itext7-core` (com.itextpdf) with explicit `<itext.version>8.0.5</itext.version>` property
  - [ ] Add `springdoc-openapi-starter-webmvc-ui` at `3.0.3` with explicit `<springdoc.version>3.0.3</springdoc.version>` property
  - [ ] Add `caffeine` (com.github.ben-manes.caffeine) — Boot-managed version via `spring-boot-starter-cache` dependency
  - [ ] Add `spring-boot-starter-cache` (Boot-managed version)
  - [ ] Add `frontend-maven-plugin` (com.github.eirslett) version `1.15.0` with explicit property `<frontend-maven-plugin.version>1.15.0</frontend-maven-plugin.version>` in `<build><plugins>` section — configured to run `npm install` + `npm run build` from `frontend/` directory, outputting to `src/main/resources/static/`
  - [ ] Pin `spring-ai.version=2.0.0-M6` already present — verify all Spring AI transitive artifacts use this version via BOM; add explicit version overrides in `<properties>` if any artifact resolves differently

- [ ] Task 2: Create Flyway migration scripts V1–V4 (AC: 5)
  - [ ] Create `src/main/resources/db/migration/V1__create_users_table.sql` — `users` table: `id UUID PK`, `email VARCHAR(255) UNIQUE NOT NULL`, `password_hash VARCHAR(255) NOT NULL`, `role VARCHAR(10) NOT NULL DEFAULT 'USER'`, `enabled BOOLEAN NOT NULL DEFAULT TRUE`, `created_at TIMESTAMP NOT NULL`, `updated_at TIMESTAMP NOT NULL`; index: `idx_users_email`
  - [ ] Create `src/main/resources/db/migration/V2__create_profiles_tables.sql` — `profiles` (1:1 with users: `id UUID PK`, `user_id UUID UNIQUE FK → users.id`, `summary TEXT`, `created_at`, `updated_at`), `profile_work_experiences` (`id UUID PK`, `profile_id UUID FK`, `job_title`, `company`, `start_date DATE`, `end_date DATE NULL`, `is_current BOOLEAN`, `description TEXT`, `created_at`, `updated_at`), `profile_education` (`id UUID PK`, `profile_id UUID FK`, `institution`, `degree`, `field_of_study`, `start_date DATE`, `end_date DATE NULL`, `created_at`, `updated_at`), `profile_skills` (`id UUID PK`, `profile_id UUID FK`, `name VARCHAR(255)`, `created_at`, `updated_at`)
  - [ ] Create `src/main/resources/db/migration/V3__create_resumes_table.sql` — `resumes` (`id UUID PK`, `user_id UUID FK → users.id`, `template_id UUID FK → resume_templates.id NULL`, `name VARCHAR(255) NOT NULL`, `resume_content JSONB NOT NULL DEFAULT '{}'`, `is_tailored BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMP NOT NULL`, `updated_at TIMESTAMP NOT NULL`); index: `idx_resumes_user_id`
  - [ ] Create `src/main/resources/db/migration/V4__create_resume_templates_table.sql` — `resume_templates` (`id UUID PK`, `name VARCHAR(255) NOT NULL`, `description TEXT`, `is_prebuilt BOOLEAN NOT NULL DEFAULT FALSE`, `is_published BOOLEAN NOT NULL DEFAULT FALSE`, `owner_id UUID FK → users.id NULL`, `template_definition JSONB NOT NULL DEFAULT '{}'`, `created_at TIMESTAMP NOT NULL`, `updated_at TIMESTAMP NOT NULL`)
  - [ ] Note: V3 references `resume_templates` — V4 must be created but V3's FK must be nullable (`template_id UUID NULL`) to avoid cross-script ordering issues; Flyway runs V1→V4 in order

- [ ] Task 3: Create `application.yml` and profile-specific configs (AC: 4, 6, 7)
  - [ ] Replace `src/main/resources/application.properties` with `application.yml`
  - [ ] Base `application.yml`: datasource (postgres), JPA (hibernate ddl-auto=validate), Flyway enabled, Spring AI Ollama base-url, multipart max-file-size=10MB, multipart max-request-size=10MB, jwt properties (`app.jwt.secret`, `app.jwt.expiration-ms=3600000`), cache type=caffeine, `spring.profiles.active=dev` (default)
  - [ ] Create `application-dev.yml`: `springdoc.api-docs.enabled=true`, `springdoc.swagger-ui.enabled=true`
  - [ ] Create `application-prod.yml`: `springdoc.api-docs.enabled=false`, `springdoc.swagger-ui.enabled=false`
  - [ ] Keep existing OpenTelemetry endpoint properties from current `application.properties`

- [ ] Task 4: Rename main application class and fix package (AC: 1)
  - [ ] Rename `CvenchancerApplication.java` → `ResumeEnhancerApplication.java` and update class name inside (architecture specifies `ResumeEnhancerApplication.java`)
  - [ ] Verify package root is `com.tsvetanbondzhov.resumeenhancer`

- [ ] Task 5: Create skeleton `config/` package classes (AC: 1, 4)
  - [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` — minimal `@Configuration` `@EnableWebSecurity` bean that permits all (temporary placeholder; Story 1.3/1.4 will implement full JWT chain); must allow app to start without 401 on all endpoints now
  - [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SpringDocConfig.java` — `@Configuration` that configures a `OpenAPI` bean with `SecurityScheme` for Bearer JWT; active only when `springdoc.api-docs.enabled=true`
  - [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/CacheConfig.java` — `@Configuration` `@EnableCaching` with a `CaffeineSpec`-based `CacheManager` bean
  - [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/WebMvcConfig.java` — `@Configuration` implementing `WebMvcConfigurer`; SPA fallback: all non-`/api/**` GET requests return `src/main/resources/static/index.html`
  - [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/JacksonConfig.java` — `@Configuration` that registers `JavaTimeModule` and sets `WRITE_DATES_AS_TIMESTAMPS=false` to serialize `Instant` → ISO 8601 UTC strings

- [ ] Task 6: Create `common/` package skeleton (AC: 1)
  - [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/BaseEntity.java` — `@MappedSuperclass` with `id` (`UUID`, `@Id @GeneratedValue(strategy=UUID)`), `createdAt` (`Instant`, `@CreatedDate`), `updatedAt` (`Instant`, `@LastModifiedDate`); annotate with `@EntityListeners(AuditingEntityListener.class)`; enable JPA auditing via `@EnableJpaAuditing` on `ResumeEnhancerApplication` or a config class
  - [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — `@RestControllerAdvice` skeleton; single handler for `Exception.class` returning `ProblemDetail` HTTP 500 (full implementation in later stories as domain exceptions are added)

- [ ] Task 7: Update `compose.yaml` (AC: 1)
  - [ ] Add `app` service skeleton to `compose.yaml` pointing to built JAR/image (can be placeholder for now — actual image build is for production; dev workflow uses `./mvnw spring-boot:run` which auto-wires existing postgres/ollama/grafana-lgtm services via `spring-boot-docker-compose`)
  - [ ] Rename `POSTGRES_DB=mydatabase` to `POSTGRES_DB=resumeenhancer` (or keep and update `application.yml` datasource to match)
  - [ ] Verify Ollama service is reachable at `http://localhost:11434` (default port mapping); Spring AI Ollama base-url in `application.yml` should be `http://localhost:11434`

- [ ] Task 8: Verify build compiles and application starts (AC: 1, 2, 3)
  - [ ] Run `./mvnw compile` — must succeed with 0 errors
  - [ ] Run `docker compose up -d` then `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` — application must start and log "Started ResumeEnhancerApplication"
  - [ ] Verify Flyway logs show V1–V4 applied successfully
  - [ ] Hit `http://localhost:8080/swagger-ui.html` — must return 200 in dev profile

## Dev Notes

### Current State of the Codebase

- **Main class:** `CvenchancerApplication.java` (typo — must be renamed to `ResumeEnhancerApplication.java`)
- **`application.properties`:** Only contains OpenTelemetry endpoint config — must be replaced with `application.yml`
- **`db/migration/`:** Empty — V1–V4 scripts do not exist yet; must be created in this story
- **`pom.xml`:** Has Spring Boot 4.0.6, Spring AI 2.0.0-M6 (Ollama starter + BOM), Flyway, JPA, WebMVC, OpenTelemetry, Lombok, PostgreSQL driver, Docker Compose integration, Testcontainers. **Missing:** Security, jjwt, POI, PDFBox, iText, Springdoc, Caffeine, frontend-maven-plugin.
- **`compose.yaml`:** Has `grafana-lgtm`, `ollama`, `postgres` services. PostgreSQL DB name is `mydatabase` — update to `resumeenhancer` in both compose and application.yml for clarity.
- **No domain packages exist yet** — only the root application class.

### Critical Architecture Rules to Follow

- **Package root:** `com.tsvetanbondzhov.resumeenhancer` — all new classes go here
- **`BaseEntity`:** `@MappedSuperclass` with UUID id + Instant timestamps — all `@Entity` classes in future stories must extend it; set it up correctly now
- **`SecurityConfig`** placeholder MUST permit-all so the app starts without auth in this story — real JWT chain is Story 1.3/1.4. Use `http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll()).csrf(csrf -> csrf.disable())` for now.
- **`GlobalExceptionHandler`:** Must return `ProblemDetail` only — never `ResponseEntity<Map<String, Object>>` — establish this pattern now even as a skeleton
- **`WebMvcConfig` SPA fallback:** Only catches non-`/api/**` GETs; must not intercept API routes. Pattern: `if (!request.getRequestURI().startsWith("/api/"))` forward to `index.html`
- **JWT properties** in `application.yml` under `app.jwt.secret` and `app.jwt.expiration-ms` — these are custom properties, not Spring-managed; they will be `@Value`-injected in Story 1.3/1.4's `TokenService`

### Dependency Versions (Explicit — Non-Negotiable)

| Dependency | GroupId | ArtifactId | Version |
|---|---|---|---|
| Spring Security | org.springframework.boot | spring-boot-starter-security | Boot-managed |
| jjwt API | io.jsonwebtoken | jjwt-api | 0.12.3 |
| jjwt Impl | io.jsonwebtoken | jjwt-impl | 0.12.3 (runtime scope) |
| jjwt Jackson | io.jsonwebtoken | jjwt-jackson | 0.12.3 (runtime scope) |
| Apache POI | org.apache.poi | poi-ooxml | 5.3.0 |
| PDFBox | org.apache.pdfbox | pdfbox | 3.0.3 |
| iText 7 Core | com.itextpdf | itext7-core | 8.0.5 (AGPL Community) |
| Springdoc | org.springdoc | springdoc-openapi-starter-webmvc-ui | 3.0.3 |
| Spring Cache | org.springframework.boot | spring-boot-starter-cache | Boot-managed |
| Caffeine | com.github.ben-manes.caffeine | caffeine | Boot-managed |
| Frontend Plugin | com.github.eirslett | frontend-maven-plugin | 1.15.0 |

**Spring AI pinning rule:** The BOM is already imported (`spring-ai-bom:2.0.0-M6`). Add `<spring-ai.version>2.0.0-M6</spring-ai.version>` to `<properties>` (already present) — this is sufficient since BOM manages all Spring AI artifacts. No additional per-artifact overrides needed unless a build warning reveals drift.

### Flyway Migration Key Constraints

- **V3 (`resumes`)** references `resume_templates.id` — but V4 creates `resume_templates`. Solution: `template_id UUID NULL` (nullable FK) in V3, which Flyway runs before V4 — the FK constraint still validates referential integrity but allows NULL while the templates table doesn't exist yet. Alternatively, define V4 before V3... but V3 is numbered lower. **Best approach: omit the FK constraint in V3 and add it in a separate V5 or later migration** when both tables exist. For now, define `template_id UUID NULL` with NO FK constraint in V3 — FK will be added later.
- **All `id` columns:** `UUID DEFAULT gen_random_uuid()` — PostgreSQL 16 supports `gen_random_uuid()` natively, no extension needed
- **All timestamp columns:** `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`
- **Enum for role:** Use `VARCHAR(10)` with a CHECK constraint `CHECK (role IN ('USER', 'ADMIN'))` — avoids PostgreSQL ENUM type which requires migration to alter

### `application.yml` Key Shape

```yaml
spring:
  application:
    name: resume-enhancer
  datasource:
    url: jdbc:postgresql://localhost:5432/resumeenhancer
    username: myuser
    password: secret
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
  ai:
    ollama:
      base-url: http://localhost:11434
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
  cache:
    type: caffeine
  profiles:
    active: dev

app:
  jwt:
    secret: "change-this-in-production-minimum-256-bit-secret-key-here"
    expiration-ms: 3600000

# OpenTelemetry (from existing application.properties)
spring:
  opentelemetry:
    tracing:
      export:
        otlp:
          endpoint: http://localhost:4318/v1/traces
    logging:
      export:
        otlp:
          endpoint: http://localhost:4318/v1/logs
    metrics:
      export:
        otlp:
          endpoint: http://localhost:4318/v1/metrics
  management:
    tracing:
      sampling:
        probability: 1.0
```

Note: Merge OTel properties correctly — they use `spring.opentelemetry` and `spring.management` prefixes from the existing `application.properties`.

### `frontend-maven-plugin` Configuration

```xml
<plugin>
  <groupId>com.github.eirslett</groupId>
  <artifactId>frontend-maven-plugin</artifactId>
  <version>${frontend-maven-plugin.version}</version>
  <configuration>
    <workingDirectory>frontend</workingDirectory>
    <installDirectory>target</installDirectory>
  </configuration>
  <executions>
    <execution>
      <id>install node and npm</id>
      <goals><goal>install-node-and-npm</goal></goals>
      <configuration>
        <nodeVersion>v22.13.0</nodeVersion>
      </configuration>
    </execution>
    <execution>
      <id>npm install</id>
      <goals><goal>npm</goal></goals>
      <phase>generate-resources</phase>
    </execution>
    <execution>
      <id>npm run build</id>
      <goals><goal>npm</goal></goals>
      <phase>generate-resources</phase>
      <configuration>
        <arguments>run build</arguments>
      </configuration>
    </execution>
  </executions>
</plugin>
```

The `frontend/` directory does not yet exist — the plugin will fail if run before Story 1.2 scaffolds it. **Add the plugin now but wrap the build executions in a Maven profile** `<id>frontend</id>` that is only activated when `frontend/` exists, OR skip frontend build in this story by not binding executions to the default lifecycle. The simplest approach: add the plugin declaration now with execution phases, but verify it doesn't break `./mvnw compile` when `frontend/` is absent — if it does, skip via `-Dskip.npm` or profile.

### `SpringDocConfig.java` Bearer JWT Scheme

```java
@Configuration
public class SpringDocConfig {
    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
            .info(new Info().title("Resume Enhancer API").version("v1"))
            .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
            .components(new Components()
                .addSecuritySchemes("bearerAuth",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
    }
}
```

### `CacheConfig.java` Caffeine Setup

```java
@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager("templates");
        manager.setCaffeine(Caffeine.newBuilder().expireAfterWrite(10, TimeUnit.MINUTES).maximumSize(100));
        return manager;
    }
}
```

### JPA Auditing

Enable via `@EnableJpaAuditing` — add to `ResumeEnhancerApplication.java` or a dedicated `JpaConfig.java` in `config/`. Without this, `@CreatedDate`/`@LastModifiedDate` on `BaseEntity` will throw an exception at startup.

### Anti-Patterns to Avoid in This Story

- **Do NOT** create a `ResponseEntity<Map<String, Object>>` response anywhere — `GlobalExceptionHandler` must use `ProblemDetail` exclusively
- **Do NOT** use `spring.jpa.hibernate.ddl-auto=create` or `update` — set to `validate`; Flyway owns the schema
- **Do NOT** commit `app.jwt.secret` with a real production secret — use a placeholder string in `application.yml`; actual secrets are environment-variable overrides in production
- **Do NOT** hardcode the PostgreSQL credentials in any Java class — only in `application.yml`

### Project Structure Notes

- `ResumeEnhancerApplication.java` replaces `CvenchancerApplication.java` — delete the old file
- New config classes go in: `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/`
- New common classes go in: `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/`
- Flyway scripts: `src/main/resources/db/migration/` (directory exists but empty)
- Config YAMLs: `src/main/resources/` (alongside, replacing `application.properties`)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1 — Acceptance Criteria & Additional Requirements]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Starter Template Evaluation, Core Architectural Decisions, Backend Package Structure, Data Architecture, Authentication & Security]
- [Source: `_bmad-output/project-context.md` — Technology Stack & Versions, Critical Implementation Rules, Anti-Patterns]
- [Source: `pom.xml` — existing dependency baseline]
- [Source: `compose.yaml` — existing Docker Compose service definitions]
- [Source: `src/main/resources/application.properties` — existing OTel config to preserve]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (bmad-create-story workflow, 2026-05-14)

### Debug Log References

### Completion Notes List

### File List

**Files to CREATE:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ResumeEnhancerApplication.java` (rename from CvenchancerApplication.java)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SpringDocConfig.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/CacheConfig.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/WebMvcConfig.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/JacksonConfig.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/BaseEntity.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- `src/main/resources/application.yml`
- `src/main/resources/application-dev.yml`
- `src/main/resources/application-prod.yml`
- `src/main/resources/db/migration/V1__create_users_table.sql`
- `src/main/resources/db/migration/V2__create_profiles_tables.sql`
- `src/main/resources/db/migration/V3__create_resumes_table.sql`
- `src/main/resources/db/migration/V4__create_resume_templates_table.sql`

**Files to MODIFY:**
- `pom.xml` — add all missing dependencies + frontend-maven-plugin
- `compose.yaml` — update postgres DB name; add `app` service stub
- `src/main/resources/application.properties` — DELETE (replaced by application.yml)

**Files to DELETE:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/CvenchancerApplication.java`
