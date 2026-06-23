package com.tsvetanbondzhov.resumeenhancer.admin;

import com.tsvetanbondzhov.resumeenhancer.admin.dto.AdminUserDto;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AdminService adminService;

    private static User user(String email, String role, boolean enabled) {
        User u = new User();
        u.setEmail(email);
        u.setRole(role);
        u.setEnabled(enabled);
        u.setPasswordHash("hash");
        return u;
    }

    @Test
    void listUsers_mapsUsersToDtoWithDerivedStatus() {
        Pageable pageable = PageRequest.of(0, 20);
        User active = user("active@example.com", "USER", true);
        User inactive = user("inactive@example.com", "ADMIN", false);
        Page<User> page = new PageImpl<>(List.of(active, inactive), pageable, 2);
        when(userRepository.findAll(pageable)).thenReturn(page);

        Page<AdminUserDto> result = adminService.listUsers(pageable);

        assertThat(result.getTotalElements()).isEqualTo(2);
        List<AdminUserDto> content = result.getContent();
        assertThat(content).hasSize(2);
        assertThat(content.get(0).email()).isEqualTo("active@example.com");
        assertThat(content.get(0).status()).isEqualTo("ACTIVE");
        assertThat(content.get(0).role()).isEqualTo("USER");
        assertThat(content.get(1).email()).isEqualTo("inactive@example.com");
        assertThat(content.get(1).status()).isEqualTo("INACTIVE");
    }

    @Test
    void deactivateUser_setsEnabledFalseAndReturnsInactiveDto() {
        UUID id = UUID.randomUUID();
        User existing = user("victim@example.com", "USER", true);
        when(userRepository.findById(id)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminUserDto dto = adminService.deactivateUser(id);

        assertThat(dto.status()).isEqualTo("INACTIVE");
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().isEnabled()).isFalse();
    }

    @Test
    void deactivateUser_missingUser_throwsUserNotFoundException() {
        UUID id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminService.deactivateUser(id))
                .isInstanceOf(UserNotFoundException.class)
                .hasMessageContaining(id.toString());

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void deactivateUser_alreadyDisabled_isIdempotentStillInactive() {
        UUID id = UUID.randomUUID();
        User existing = user("already@example.com", "USER", false);
        when(userRepository.findById(id)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminUserDto dto = adminService.deactivateUser(id);

        assertThat(dto.status()).isEqualTo("INACTIVE");
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().isEnabled()).isFalse();
    }
}
