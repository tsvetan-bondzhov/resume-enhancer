package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class TokenServiceTest {

    private static final Instant FIXED_INSTANT = Instant.parse("2099-01-01T00:00:00Z");
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
        assertThat(issuedAt).isEqualTo(FIXED_INSTANT.truncatedTo(ChronoUnit.SECONDS));
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
