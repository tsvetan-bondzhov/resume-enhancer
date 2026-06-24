package com.tsvetanbondzhov.resumeenhancer.admin;

import com.tsvetanbondzhov.resumeenhancer.admin.dto.AdminUserDto;
import com.tsvetanbondzhov.resumeenhancer.auth.TokenService;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.AuthResponse;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.UserDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final TokenService tokenService;

    public AdminService(UserRepository userRepository, TokenService tokenService) {
        this.userRepository = userRepository;
        this.tokenService = tokenService;
    }

    public Page<AdminUserDto> listUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(AdminUserDto::fromUser);
    }

    /**
     * Deactivates a user by setting {@code enabled = false}. Idempotent — deactivating
     * an already-disabled user is a no-op that still returns the INACTIVE DTO.
     * Resumes and profile data are untouched.
     *
     * @throws UserNotFoundException if no user exists for {@code userId}
     */
    public AdminUserDto deactivateUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        user.setEnabled(false);
        User saved = userRepository.save(user);
        return AdminUserDto.fromUser(saved);
    }

    /**
     * Activates a user by setting {@code enabled = true}. Idempotent — activating
     * an already-enabled user is a no-op that still returns the ACTIVE DTO.
     *
     * @throws UserNotFoundException if no user exists for {@code userId}
     */
    public AdminUserDto activateUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        user.setEnabled(true);
        User saved = userRepository.save(user);
        return AdminUserDto.fromUser(saved);
    }

    /**
     * Issues an auth token acting as the target user (impersonation). Only active,
     * non-admin users may be impersonated — impersonating another admin or a
     * deactivated account is rejected.
     *
     * @throws UserNotFoundException if no user exists for {@code userId}
     * @throws ImpersonationNotAllowedException if the target is an admin or disabled
     */
    public AuthResponse impersonateUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        if ("ADMIN".equals(user.getRole()) || !user.isEnabled()) {
            throw new ImpersonationNotAllowedException(userId);
        }
        String token = tokenService.generateToken(user);
        return new AuthResponse(token, UserDto.fromUser(user));
    }
}
