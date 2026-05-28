package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.AuthResponse;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.LoginRequest;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.SignupRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private TokenService tokenService;

    @InjectMocks
    private AuthService authService;

    @Test
    void login_validCredentials_returnsToken() {
        // Given
        LoginRequest request = new LoginRequest("test@example.com", "password123");

        User user = new User();
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        user.setEnabled(true);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "hashed-password")).thenReturn(true);
        when(tokenService.generateToken(user)).thenReturn("jwt-token-value");

        // When
        AuthResponse response = authService.login(request);

        // Then
        assertThat(response.token()).isEqualTo("jwt-token-value");
        verify(tokenService).generateToken(user);
    }

    @Test
    void login_unknownEmail_throwsInvalidCredentialsException() {
        // Given
        LoginRequest request = new LoginRequest("unknown@example.com", "password123");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");

        verify(tokenService, never()).generateToken(any(User.class));
    }

    @Test
    void login_wrongPassword_throwsInvalidCredentialsException() {
        // Given
        LoginRequest request = new LoginRequest("test@example.com", "wrong-password");

        User user = new User();
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        user.setEnabled(true);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "hashed-password")).thenReturn(false);

        // When / Then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");

        verify(tokenService, never()).generateToken(any(User.class));
    }

    @Test
    void signup_happyPath_returnsToken() {
        // Given
        SignupRequest request = new SignupRequest("test@example.com", "password123");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("hashed-password");

        User savedUser = new User();
        savedUser.setEmail("test@example.com");
        savedUser.setPasswordHash("hashed-password");
        savedUser.setRole("USER");
        savedUser.setEnabled(true);
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(tokenService.generateToken(savedUser)).thenReturn("jwt-token-value");

        // When
        AuthResponse response = authService.signup(request);

        // Then
        assertThat(response.token()).isEqualTo("jwt-token-value");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User capturedUser = userCaptor.getValue();
        assertThat(capturedUser.getEmail()).isEqualTo("test@example.com");
        assertThat(capturedUser.getPasswordHash()).isEqualTo("hashed-password");
        assertThat(capturedUser.getRole()).isEqualTo("USER");
        assertThat(capturedUser.isEnabled()).isTrue();
    }

    @Test
    void signup_duplicateEmail_throwsEmailAlreadyExistsException() {
        // Given
        SignupRequest request = new SignupRequest("existing@example.com", "password123");

        User existingUser = new User();
        existingUser.setEmail("existing@example.com");
        when(userRepository.findByEmail("existing@example.com")).thenReturn(Optional.of(existingUser));

        // When / Then
        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(EmailAlreadyExistsException.class)
                .hasMessageContaining("existing@example.com");

        verify(userRepository, never()).save(any(User.class));
        verify(tokenService, never()).generateToken(any(User.class));
    }

    @Test
    void signup_blankPassword_serviceEncodesWithoutValidating() {
        // Note: @NotBlank/@Size validation on SignupRequest is enforced at the controller layer
        // via @Valid. This test verifies AuthService behavior when a blank password is provided
        // directly (bypassing controller validation), ensuring the service does not duplicate
        // the constraint and delegates encoding unconditionally to PasswordEncoder.
        // The actual constraint is enforced by Jakarta Validation before AuthService is invoked.

        SignupRequest request = new SignupRequest("test@example.com", "");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("")).thenReturn("encoded-blank");

        User savedUser = new User();
        savedUser.setEmail("test@example.com");
        savedUser.setPasswordHash("encoded-blank");
        savedUser.setRole("USER");
        savedUser.setEnabled(true);
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(tokenService.generateToken(savedUser)).thenReturn("jwt-token");

        // AuthService itself does not throw on blank password — validation is at the controller layer
        AuthResponse response = authService.signup(request);
        assertThat(response.token()).isEqualTo("jwt-token");
        verify(passwordEncoder).encode("");
    }
}
