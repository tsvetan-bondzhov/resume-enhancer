package com.tsvetanbondzhov.resumeenhancer.admin;

import com.tsvetanbondzhov.resumeenhancer.admin.dto.AdminUserDto;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.AuthResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<AdminUserDto> listUsers(
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return adminService.listUsers(pageable);
    }

    @PatchMapping("/users/{userId}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public AdminUserDto deactivateUser(@PathVariable UUID userId) {
        return adminService.deactivateUser(userId);
    }

    @PatchMapping("/users/{userId}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public AdminUserDto activateUser(@PathVariable UUID userId) {
        return adminService.activateUser(userId);
    }

    @PostMapping("/users/{userId}/impersonate")
    @PreAuthorize("hasRole('ADMIN')")
    public AuthResponse impersonateUser(@PathVariable UUID userId) {
        return adminService.impersonateUser(userId);
    }
}
