package com.tsvetanbondzhov.resumeenhancer.auth.domain;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    private User buildUser(String email, String passwordHash, String role, boolean enabled) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordHash);
        user.setRole(role);
        user.setEnabled(enabled);
        return user;
    }

    // Line 36: getAuthorities() returns ROLE_<role>
    @Test
    void getAuthorities_returnsRolePrefixedAuthority() {
        User user = buildUser("user@example.com", "hash", "USER", true);

        Collection<? extends GrantedAuthority> authorities = user.getAuthorities();

        assertThat(authorities).hasSize(1);
        assertThat(authorities.iterator().next().getAuthority()).isEqualTo("ROLE_USER");
    }

    // Line 36: getAuthorities() with ADMIN role
    @Test
    void getAuthorities_adminRole_returnsRoleAdminAuthority() {
        User user = buildUser("admin@example.com", "hash", "ADMIN", true);

        Collection<? extends GrantedAuthority> authorities = user.getAuthorities();

        assertThat(authorities).hasSize(1);
        assertThat(authorities.iterator().next().getAuthority()).isEqualTo("ROLE_ADMIN");
    }

    // Line 41: getPassword() returns passwordHash
    @Test
    void getPassword_returnsPasswordHash() {
        User user = buildUser("user@example.com", "hashed-secret", "USER", true);

        assertThat(user.getPassword()).isEqualTo("hashed-secret");
    }
}
