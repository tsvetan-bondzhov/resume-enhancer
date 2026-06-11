package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    PasswordEncoder passwordEncoder;

    @InjectMocks
    UserService userService;

    @Test
    void changePassword_correctCurrentPassword_updatesHash() {
        User user = new User();
        user.setPasswordHash("$2a$10$old-hash");
        when(passwordEncoder.matches("oldpass", "$2a$10$old-hash")).thenReturn(true);
        when(passwordEncoder.encode("newpass123")).thenReturn("$2a$10$new-hash");

        userService.changePassword(user, "oldpass", "newpass123");

        assertThat(user.getPasswordHash()).isEqualTo("$2a$10$new-hash");
        verify(userRepository).save(user);
    }

    @Test
    void changePassword_wrongCurrentPassword_throwsException() {
        User user = new User();
        user.setPasswordHash("$2a$10$old-hash");
        when(passwordEncoder.matches("wrongpass", "$2a$10$old-hash")).thenReturn(false);

        assertThatThrownBy(() -> userService.changePassword(user, "wrongpass", "newpass123"))
                .isInstanceOf(InvalidCurrentPasswordException.class);
        verify(userRepository, never()).save(any());
    }
}
