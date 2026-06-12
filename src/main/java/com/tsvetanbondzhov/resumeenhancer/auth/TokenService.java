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
