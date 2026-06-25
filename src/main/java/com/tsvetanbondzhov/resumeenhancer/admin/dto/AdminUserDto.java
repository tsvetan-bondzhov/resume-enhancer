package com.tsvetanbondzhov.resumeenhancer.admin.dto;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;

import java.time.Instant;
import java.util.UUID;

/**
 * Admin-facing view of a registered user account.
 *
 * <p>{@code status} is a presentation concept derived from the persisted
 * {@code enabled} boolean on the {@link User} entity — there is no {@code status}
 * column in the {@code users} table. {@code enabled == true} maps to
 * {@code "ACTIVE"}, otherwise {@code "INACTIVE"}.
 */
public record AdminUserDto(
        UUID id,
        String email,
        String role,
        String status,
        Instant createdAt
) {
    public static AdminUserDto fromUser(User user) {
        return new AdminUserDto(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                user.isEnabled() ? "ACTIVE" : "INACTIVE",
                user.getCreatedAt()
        );
    }
}
