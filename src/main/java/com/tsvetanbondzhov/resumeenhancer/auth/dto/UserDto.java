package com.tsvetanbondzhov.resumeenhancer.auth.dto;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;

import java.util.UUID;

/**
 * Client-facing view of a registered user account. Intentionally excludes the
 * password hash and any other sensitive fields so it is safe to return in
 * authentication responses.
 */
public record UserDto(
        UUID id,
        String email,
        String role,
        boolean enabled
) {
    public static UserDto fromUser(User user) {
        return new UserDto(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                user.isEnabled()
        );
    }
}
