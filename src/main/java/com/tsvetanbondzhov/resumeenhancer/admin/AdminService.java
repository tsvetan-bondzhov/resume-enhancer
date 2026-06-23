package com.tsvetanbondzhov.resumeenhancer.admin;

import com.tsvetanbondzhov.resumeenhancer.admin.dto.AdminUserDto;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AdminService {

    private final UserRepository userRepository;

    public AdminService(UserRepository userRepository) {
        this.userRepository = userRepository;
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
}
