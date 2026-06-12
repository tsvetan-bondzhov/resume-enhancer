# Story 9.8: Java Test Quality — Time Constants & Deterministic Clock

**Status:** done
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-8-java-test-quality-time-constants-and-clock
**Dependencies:** None (9.7 done; all affected files are backend Java test files plus one main-source file)

---

## Story

As a developer,
I want Java tests to use `java.time.Month` enum constants instead of magic integer literals, inject a deterministic fixed clock instead of the system clock, and replace `java.util.Date` with the modern `java.time` API,
So that test behaviour is predictable, readable, and free of time-dependent flakiness.

---

## Acceptance Criteria

**AC1 — Integer month literals replaced with `Month` enum (S8694)**
**Given** Java test code passes integer literals as month arguments (e.g., `LocalDate.of(2024, 3, 15)`) in the affected test files
**When** the fix is applied
**Then** every integer month argument is replaced with the corresponding `java.time.Month` enum value (e.g., `LocalDate.of(2024, Month.MARCH, 15)`); the `java.time.Month` import is added where absent

**AC2 — Deterministic `Clock` injected into `TokenService` (S8692)**
**Given** `TokenService.generateToken()` calls `new Date()` and `new Date(System.currentTimeMillis() + expirationMs)` so generated JWTs are non-deterministic
**When** the fix is applied
**Then** `TokenService` accepts a `java.time.Clock` via constructor injection; `generateToken()` derives timestamps from the injected clock (`Instant.now(clock)`) not from `System.currentTimeMillis()`; Spring wires `Clock.systemUTC()` automatically (via `@Bean` or constructor default); a new `TokenServiceTest.java` verifies token expiry using `Clock.fixed(...)` so the test is time-independent

**AC3 — `java.util.Date` replaced with `java.time.Instant` in `TokenService` (S2143)**
**Given** `TokenService.java` uses `new Date()` and `new Date(...)` for JWT issuance and expiry timestamps
**When** the fix is applied
**Then** internal logic uses `Instant` exclusively; `Date.from(instant)` is used only at the jjwt API boundary (`.issuedAt(Date.from(issuedAt))`, `.expiration(Date.from(expiresAt))`); `java.util.Date` import is removed from `TokenService.java`

**AC4 — `TemplateServiceTest` `Instant.now()` made deterministic (S8692)**
**Given** `TemplateServiceTest.buildTemplate()` calls `Instant.now()` twice to set `createdAt`/`updatedAt` fields via `ReflectionTestUtils`
**When** the fix is applied
**Then** `Instant.now()` is replaced with a fixed instant constant (e.g., `Instant.parse("2024-01-15T10:00:00Z")`); the assertions remain correct and time-independent

**AC5 — All tests pass and SonarQube violations cleared**
**Given** the story is implemented
**When** `./mvnw test` is run
**Then** all tests compile and pass; SonarQube re-scan shows 0 remaining S8694, S8692, and S2143 violations

---

## Tasks / Subtasks

### Task 1: Replace integer month literals with `Month` enum in `ResumeItemSerializationTest.java` (AC1)

**File:** `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeItemSerializationTest.java`

**Current integer month occurrences (18 total — 8 `LocalDate.of(...)` calls):**

| Line | Current | Required |
|------|---------|----------|
| 45 | `LocalDate.of(2020, 1, 1)` | `LocalDate.of(2020, Month.JANUARY, 1)` |
| 45 | `LocalDate.of(2023, 6, 30)` | `LocalDate.of(2023, Month.JUNE, 30)` |
| 57 | `LocalDate.of(2020, 1, 1)` | `LocalDate.of(2020, Month.JANUARY, 1)` |
| 65 | `LocalDate.of(2016, 9, 1)` | `LocalDate.of(2016, Month.SEPTEMBER, 1)` |
| 65 | `LocalDate.of(2020, 6, 1)` | `LocalDate.of(2020, Month.JUNE, 1)` |
| 75 | `LocalDate.of(2020, 6, 1)` | `LocalDate.of(2020, Month.JUNE, 1)` |
| 95 | `LocalDate.of(2023, 1, 15)` | `LocalDate.of(2023, Month.JANUARY, 15)` |
| 105 | `LocalDate.of(2023, 1, 15)` | `LocalDate.of(2023, Month.JANUARY, 15)` |
| 123 | `LocalDate.of(2022, 1, 1)` | `LocalDate.of(2022, Month.JANUARY, 1)` |
| 140 | `LocalDate.of(2021, 6, 1)` | `LocalDate.of(2021, Month.JUNE, 1)` |

**Import to add:**
```java
import java.time.Month;
```

**Implementation checklist:**
- [x] Add `import java.time.Month;` after the existing `import java.time.LocalDate;` line
- [x] Replace all 10 integer month arguments in `LocalDate.of(...)` calls with `Month.*` enum constants
- [x] Verify `LocalDate.of(year, Month.X, day)` signature — `LocalDate.of(int, Month, int)` is a valid overload in `java.time.LocalDate`

---

### Task 2: Replace integer month literals with `Month` enum in `ResumeServiceTest.java` (AC1)

**File:** `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java`

**Current integer month occurrences (1 `LocalDate.of(...)` call):**

| Line | Current | Required |
|------|---------|----------|
| 203 | `cert.setIssueDate(LocalDate.of(2023, 6, 1))` | `cert.setIssueDate(LocalDate.of(2023, Month.JUNE, 1))` |

**Import to add:**
```java
import java.time.Month;
```

**Implementation checklist:**
- [x] Add `import java.time.Month;` to the imports block (alphabetical, after `java.time.LocalDate`)
- [x] Replace the one `LocalDate.of(2023, 6, 1)` with `LocalDate.of(2023, Month.JUNE, 1)`

---

### Task 3: Replace integer month literals with `Month` enum in `LlmSectionExtractorTest.java` (AC1)

**File:** `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java`

**Current integer month occurrences (2 `LocalDate.of(...)` calls in assertions):**

| Line | Current | Required |
|------|---------|----------|
| 149 | `LocalDate.of(2020, 1, 1)` | `LocalDate.of(2020, Month.JANUARY, 1)` |
| 150 | `LocalDate.of(2023, 6, 1)` | `LocalDate.of(2023, Month.JUNE, 1)` |

**Import to add:**
```java
import java.time.Month;
```

**Implementation checklist:**
- [x] Add `import java.time.Month;` after the existing `import java.time.LocalDate;` line (line 21)
- [x] Replace the two integer month literals in the assertions on lines 149-150

---

### Task 4: Replace integer month literals with `Month` enum in `ProfileServiceTest.java` (AC1)

**File:** `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java`

**Current integer month occurrences (7 `LocalDate.of(...)` calls):**

| Line | Current | Required |
|------|---------|----------|
| 96 | `LocalDate.of(2020, 1, 1)` | `LocalDate.of(2020, Month.JANUARY, 1)` |
| 107 | `LocalDate.of(2015, 9, 1)` | `LocalDate.of(2015, Month.SEPTEMBER, 1)` |
| 108 | `LocalDate.of(2019, 6, 1)` | `LocalDate.of(2019, Month.JUNE, 1)` |
| 142 | `LocalDate.of(2020, 1, 1)` | `LocalDate.of(2020, Month.JANUARY, 1)` |
| 143 | `LocalDate.of(2018, 9, 1)` | `LocalDate.of(2018, Month.SEPTEMBER, 1)` |
| 143 | `LocalDate.of(2020, 6, 1)` | `LocalDate.of(2020, Month.JUNE, 1)` |
| 233 | `LocalDate.of(2023, 1, 1)` | `LocalDate.of(2023, Month.JANUARY, 1)` |
| 317 | `LocalDate.of(2023, 5, 1)` | `LocalDate.of(2023, Month.MAY, 1)` |

**Import to add:**
```java
import java.time.Month;
```

**Implementation checklist:**
- [x] Add `import java.time.Month;` after the existing `import java.time.LocalDate;` line
- [x] Replace all 8 integer month arguments with `Month.*` enum constants

---

### Task 5: Fix `TemplateServiceTest` — replace `Instant.now()` with a fixed constant (AC4)

**File:** `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java`

**Current state (lines 47-48):**
```java
ReflectionTestUtils.setField(t, "createdAt", Instant.now());
ReflectionTestUtils.setField(t, "updatedAt", Instant.now());
```

**Root cause:** S8692 flags `Instant.now()` in tests because the test outcome depends on the real wall-clock time. These fields are set but not meaningfully asserted on — they're only populated so `toDto()` does not receive null. Use a fixed constant instead.

**Required change — add a constant to the class:**
```java
private static final Instant FIXED_NOW = Instant.parse("2024-01-15T10:00:00Z");
```

**Then replace both `Instant.now()` calls:**
```java
ReflectionTestUtils.setField(t, "createdAt", FIXED_NOW);
ReflectionTestUtils.setField(t, "updatedAt", FIXED_NOW);
```

**Implementation checklist:**
- [x] Add `private static final Instant FIXED_NOW = Instant.parse("2024-01-15T10:00:00Z");` as a class-level constant (near `TEMPLATE_ID` constant on line 35)
- [x] Replace `Instant.now()` on line 47 with `FIXED_NOW`
- [x] Replace `Instant.now()` on line 48 with `FIXED_NOW`
- [x] Verify `Instant` is already imported (it is — line 13)
- [x] No assertions use these timestamp values directly — the change is safe and test semantics are identical

---

### Task 6: Refactor `TokenService.java` — inject `Clock` and replace `java.util.Date` (AC2, AC3)

**File:** `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenService.java`

**Current state:**
```java
import java.util.Date;

// ...constructor has only secret + expirationMs

public String generateToken(User user) {
    return Jwts.builder()
            .subject(user.getEmail())
            .claim("role", user.getRole())
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expirationMs))
            .signWith(getSigningKey())
            .compact();
}
```

**Required change — full `TokenService.java` refactor:**

```java
package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;

@Service
public class TokenService {

    private final String secret;
    private final long expirationMs;
    private final Clock clock;

    public TokenService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMs,
            Clock clock) {
        this.secret = secret;
        this.expirationMs = expirationMs;
        this.clock = clock;
    }

    public String generateToken(User user) {
        Instant issuedAt = Instant.now(clock);
        Instant expiresAt = issuedAt.plusMillis(expirationMs);
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("role", user.getRole())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(getSigningKey())
                .compact();
    }

    public Claims validateToken(String token) throws JwtException {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return validateToken(token).getSubject();
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
```

**Key decisions:**
- `java.util.Date` import is KEPT because `Date.from(...)` is still required at the jjwt boundary (S2143 requires removing `new Date()` — `Date.from(Instant)` is the accepted jjwt boundary adapter, not itself a violation)
- `Clock clock` parameter enables test injection of `Clock.fixed(...)` without Spring context
- `Instant.now(clock)` replaces `System.currentTimeMillis()` — fully deterministic under injected clock
- `expiresAt = issuedAt.plusMillis(expirationMs)` preserves the existing token TTL semantics exactly

**Implementation checklist:**
- [x] Add `java.time.Clock` import
- [x] Add `java.time.Instant` import (replace raw `System.currentTimeMillis` logic)
- [x] Keep `java.util.Date` import — still needed for `Date.from()`
- [x] Add `private final Clock clock;` field
- [x] Add `Clock clock` as third constructor parameter
- [x] Replace `new Date()` with `Date.from(issuedAt)` where `issuedAt = Instant.now(clock)`
- [x] Replace `new Date(System.currentTimeMillis() + expirationMs)` with `Date.from(expiresAt)` where `expiresAt = issuedAt.plusMillis(expirationMs)`

---

### Task 7: Register `Clock.systemUTC()` as a Spring Bean (AC2)

**Problem:** `TokenService` now requires `Clock` via constructor injection. Spring's `@Autowired` (used by `@InjectMocks` + `@SpringBootTest`) will fail unless a `Clock` bean exists.

**Approach:** Add the bean to the existing application config. Look for an existing `@Configuration` class in `src/main/java/.../config/`:
```
src/main/java/com/tsvetanbondzhov/resumeenhancer/config/
```

**Implementation checklist:**
- [x] List the config package to find the right configuration class
- [x] Add `@Bean public Clock clock() { return Clock.systemUTC(); }` to an appropriate `@Configuration` class (e.g., `AppConfig.java` or `JacksonConfig.java` — use whichever already has infrastructure beans, or create a minimal `ClockConfig.java` if none fits)
- [x] `import java.time.Clock;` must be added to the config class
- [x] Verify the bean is in the `com.tsvetanbondzhov.resumeenhancer.config` package (follows `config/` isolation rule from project-context.md)

---

### Task 8: Create `TokenServiceTest.java` using `Clock.fixed(...)` (AC2, AC5)

**File:** `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenServiceTest.java` (**NEW FILE**)

**Purpose:** Verify token generation is deterministic and expiry is calculated correctly using `Clock.fixed(...)`.

**Required test class:**
```java
package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.Month;
import java.time.ZoneOffset;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class TokenServiceTest {

    private static final Instant FIXED_INSTANT = Instant.parse("2024-06-15T10:00:00Z");
    private static final Clock FIXED_CLOCK = Clock.fixed(FIXED_INSTANT, ZoneOffset.UTC);

    // Minimal valid HMAC-SHA256 key (32 bytes, base64-encoded)
    private static final String TEST_SECRET =
            Base64.getEncoder().encodeToString(new byte[32]);
    private static final long EXPIRATION_MS = 3_600_000L; // 1 hour

    private final TokenService tokenService =
            new TokenService(TEST_SECRET, EXPIRATION_MS, FIXED_CLOCK);

    private User buildUser() {
        User user = new User();
        user.setEmail("test@example.com");
        user.setRole("USER");
        user.setEnabled(true);
        user.setPasswordHash("hash");
        return user;
    }

    @Test
    void generateToken_containsSubjectAndRole() {
        User user = buildUser();
        String token = tokenService.generateToken(user);

        Claims claims = tokenService.validateToken(token);
        assertThat(claims.getSubject()).isEqualTo("test@example.com");
        assertThat(claims.get("role", String.class)).isEqualTo("USER");
    }

    @Test
    void generateToken_issuedAtMatchesFixedClock() {
        User user = buildUser();
        String token = tokenService.generateToken(user);

        Claims claims = tokenService.validateToken(token);
        // issuedAt is truncated to seconds by JWT spec
        Instant issuedAt = claims.getIssuedAt().toInstant();
        assertThat(issuedAt).isEqualTo(FIXED_INSTANT.truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
    }

    @Test
    void generateToken_expirationIsIssuedAtPlusExpirationMs() {
        User user = buildUser();
        String token = tokenService.generateToken(user);

        Claims claims = tokenService.validateToken(token);
        Instant issuedAt = claims.getIssuedAt().toInstant();
        Instant expiration = claims.getExpiration().toInstant();
        assertThat(expiration).isEqualTo(issuedAt.plusMillis(EXPIRATION_MS));
    }

    @Test
    void extractEmail_returnsTokenSubject() {
        User user = buildUser();
        String token = tokenService.generateToken(user);

        assertThat(tokenService.extractEmail(token)).isEqualTo("test@example.com");
    }
}
```

**Implementation checklist:**
- [x] Create the file at `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenServiceTest.java`
- [x] The test creates `TokenService` directly (no Spring context, no `@ExtendWith(MockitoExtension.class)` needed — it's a plain unit test)
- [x] `TEST_SECRET` is a 32-byte zero array base64-encoded — sufficient for HMAC-SHA256 in tests
- [x] Note: JWT times are second-precision — the assertion uses `truncatedTo(ChronoUnit.SECONDS)` to match
- [x] Verify `User` constructor or setters — `User` is a JPA entity with setters (see `buildUser()` pattern in `ProfileServiceTest.java`)

---

### Task 9: Run all backend tests (AC5)

- [x] `./mvnw test` from project root — all tests must pass
- [ ] Specifically verify:
  - `TokenServiceTest` — all 4 new tests pass
  - `TemplateServiceTest` — still passes with `FIXED_NOW` constant
  - `ResumeItemSerializationTest` — all 10 tests pass with `Month.*` constants
  - `ProfileServiceTest` — all tests pass
  - `ResumeServiceTest` — passes
  - `LlmSectionExtractorTest` — passes
  - Integration tests (`ResumeControllerIntegrationTest`) — still pass (NOT touched in this story)

**Note:** `ResumeControllerIntegrationTest.java:334` also uses `Instant.now()` in an assertion (`assertThat(parsed).isAfter(Instant.now().minusSeconds(60))`). This is an integration test verifying a real `updatedAt` timestamp just written by the server — this is a valid wall-clock comparison for integration tests (the comparison is relative, not absolute). **Do NOT change this.** It is semantically different from S8692 which targets setting up test data against wall time.

---

## Dev Notes & Guardrails

### Understanding the SonarQube Rules

**S8694 — Use `Month` enum constants**
`LocalDate.of(2020, 1, 1)` is ambiguous — is `1` January or day 1? `LocalDate.of(2020, Month.JANUARY, 1)` is unambiguous. SonarQube S8694 fires on every integer used as the month argument in `LocalDate.of(year, monthInt, day)` and related calls. This story has 21 such occurrences across 4 test files.

**S8692 — Don't use system clock in tests**
`Instant.now()`, `LocalDate.now()`, and `System.currentTimeMillis()` in test code make tests time-sensitive. S8692 fires when these are used in test setup or assertion context. The fix: use a fixed constant or `Clock.fixed(...)` for all time-sensitive setup.

- `TemplateServiceTest.java` lines 47-48: `Instant.now()` used to populate `BaseEntity` fields — replace with `FIXED_NOW` constant.
- `TokenService.java` (prod code): `System.currentTimeMillis()` called at token generation time — inject `Clock` so tests can use `Clock.fixed(...)`.

**S2143 — Use `java.time` instead of `java.util.Date`**
`java.util.Date` is legacy. SonarQube S2143 fires on its usage. In `TokenService`, `new Date()` and `new Date(long)` are used for jjwt. The fix: use `Instant` internally, convert with `Date.from(Instant)` only at the jjwt API boundary. The jjwt `JwtBuilder.issuedAt(Date)` and `.expiration(Date)` still accept `java.util.Date` — this is fine.

### File Location Map

```
src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeItemSerializationTest.java  — Task 1 (S8694 × 10)
src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java             — Task 2 (S8694 × 1)
src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java       — Task 3 (S8694 × 2)
src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java           — Task 4 (S8694 × 8)
src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java         — Task 5 (S8692 × 2)
src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenService.java                    — Task 6 (S8692 + S2143)
src/main/java/com/tsvetanbondzhov/resumeenhancer/config/                                   — Task 7 (Clock bean)
src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenServiceTest.java                — Task 8 (NEW FILE)
```

### Clock Bean — Where to Add It

Before Task 7, list the config directory:
```
src/main/java/com/tsvetanbondzhov/resumeenhancer/config/
```
Typical files include `JacksonConfig.java`, `SecurityConfig.java`, `WebMvcConfig.java`. Add `@Bean Clock clock()` to whichever already holds infrastructure/utility beans — or create `ClockConfig.java` if all existing configs are security/web-focused. The bean must live in the `config` package per `project-context.md` rule: "config/ package is isolated from domain packages".

### What NOT to Change

- `src/test/java/.../resume/ResumeControllerIntegrationTest.java` line 334 — `Instant.now()` is used in a relative assertion (`isAfter(Instant.now().minusSeconds(60))`) for a real server response. This is an integration test validating real-time behaviour — leave it untouched.
- Any production code other than `TokenService.java` — all other S8694 violations are in test files only.
- `@Spy ObjectMapper` in `LlmSectionExtractorTest.java` — unrelated to this story; do not modify.
- `TemplateServiceTest.java` assertions that use `result.createdAt()` or `result.updatedAt()` — check whether any such assertions exist before applying `FIXED_NOW`; if assertions compare specific values, ensure `FIXED_NOW` matches what `toDto()` maps from `createdAt`/`updatedAt`.

### Commit Pattern

Follow the established Epic 9 convention:
```
feat(9-8-java-test-quality-time-constants-and-clock): <description>
```

### SonarQube Rules Summary

| Rule | Name | Severity | Instances | Files |
|------|------|----------|-----------|-------|
| `java:S8694` | Use `Month` enum, not int | MINOR | 21 | 4 test files |
| `java:S8692` | Don't use system clock in tests | INFO | 2 | `TemplateServiceTest.java`, `TokenService.java` (via test) |
| `java:S2143` | Use `java.time` not `java.util.Date` | INFO | 1 | `TokenService.java` |

### Previous Story Intelligence (from Story 9.7 — done)

- Commit convention: `feat(9-X-story-key): <description>`
- Backend tests only: `./mvnw test` from project root — no frontend changes in this story
- Story 9.4 (`LlmSectionExtractorTest`) established the pattern: `@ExtendWith(MockitoExtension.class)` + `@Spy` for ObjectMapper — do not disturb this setup
- Story 9.2 fixed empty test methods and string constants — this story adds a new test class (`TokenServiceTest.java`) following the `@ExtendWith(MockitoExtension.class)` — NOT required; `TokenService` has no mocked dependencies, use a plain class-level instantiation
- `ProfileServiceTest.java` uses `@BeforeEach setUp()` with direct `new ProfileService(...)` constructor injection — `TokenServiceTest.java` should follow the same pattern: direct construction, no Mockito extension needed

### jjwt API Note

The project uses `jjwt 0.12.x` (`jjwt-api`, `jjwt-impl`, `jjwt-jackson`) per `project-context.md`. In jjwt 0.12.x:
- `JwtBuilder.issuedAt(Date)` and `.expiration(Date)` still accept `java.util.Date`
- `Date.from(Instant)` is the correct bridge from `java.time.Instant` to `java.util.Date`
- JWT timestamps have **second-precision** — fractional milliseconds in `Instant` are truncated. The `TokenServiceTest` assertion for `issuedAt` must use `truncatedTo(ChronoUnit.SECONDS)`.

### Spring DI Note

`TokenService` is annotated `@Service` and Spring Boot will auto-wire all constructor parameters. Since `Clock` is not a Spring-managed bean by default, **Task 7 is mandatory before Task 8 will work in an integration context.** Unit tests (`TokenServiceTest`) pass `Clock.fixed(...)` directly via the constructor so they do NOT require the Spring bean.

---

## Story Completion Status

**Analysis completed:** 2026-06-12
**Files analyzed:**
- `src/test/java/.../resume/ResumeItemSerializationTest.java` — 10 integer month literals in `LocalDate.of()` calls (lines 45, 57, 65, 75, 95, 105, 123, 140)
- `src/test/java/.../resume/ResumeServiceTest.java` — 1 integer month literal (line 203)
- `src/test/java/.../upload/LlmSectionExtractorTest.java` — 2 integer month literals in assertions (lines 149-150)
- `src/test/java/.../profile/ProfileServiceTest.java` — 8 integer month literals across multiple tests (lines 96, 107, 108, 142, 143, 143, 233, 317)
- `src/test/java/.../template/TemplateServiceTest.java` — 2 `Instant.now()` calls in `buildTemplate()` (lines 47-48)
- `src/main/java/.../auth/TokenService.java` — 2 `new Date()` calls + `System.currentTimeMillis()` (lines 32-33)
- `src/test/java/.../resume/ResumeControllerIntegrationTest.java` — 1 `Instant.now()` in relative assertion (line 334) — intentionally excluded (semantically different)
- Story 9.7 (done) — commit pattern and test workflow confirmed
- Git log (last 8 commits) — confirms commit message convention and backend-only story pattern

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- AC1 (S8694): Replaced all 21 integer month literals with `Month.*` enum constants across 4 test files; added `import java.time.Month` where absent.
- AC2 (S8692): Added `Clock clock` field + constructor param to `TokenService`; `generateToken()` now uses `Instant.now(clock)`; `Clock.systemUTC()` bean registered in `JacksonConfig`; `AuthControllerIntegrationTest` updated to pass `Clock.systemUTC()` to the local `TokenService` instantiation.
- AC3 (S2143): `TokenService` internal logic uses `Instant` exclusively; `Date.from(Instant)` only at jjwt boundary; `java.util.Date` import kept for `Date.from()`.
- AC4 (S8692): `TemplateServiceTest` uses `FIXED_NOW = Instant.parse("2024-01-15T10:00:00Z")` constant instead of `Instant.now()`.
- AC5: `./mvnw test` — 114 tests, 0 failures, 0 errors.
- Note: `TokenServiceTest.FIXED_INSTANT` set to `2099-01-01T00:00:00Z` (far future) so jjwt's system-clock expiry check never rejects the test token.

### File List

- src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeItemSerializationTest.java
- src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java
- src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java
- src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java
- src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java
- src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenService.java
- src/main/java/com/tsvetanbondzhov/resumeenhancer/config/JacksonConfig.java
- src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenServiceTest.java (NEW)
- src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java

### Change Log

- 2026-06-12: Implemented all ACs — replaced integer month literals with `Month` enum (S8694, 21 occurrences across 4 test files), injected deterministic `Clock` into `TokenService` (S8692/S2143), added `Clock.systemUTC()` Spring bean in `JacksonConfig`, created `TokenServiceTest.java` with 4 deterministic tests, fixed `TemplateServiceTest` with `FIXED_NOW` constant. 114 tests pass.
