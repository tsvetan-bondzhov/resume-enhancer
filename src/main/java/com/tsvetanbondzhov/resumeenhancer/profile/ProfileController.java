package com.tsvetanbondzhov.resumeenhancer.profile;

import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileUpdateRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile")
@Tag(name = "Profile")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ProfileDto getProfile(Authentication authentication) {
        return profileService.getProfile(authentication.getName());
    }

    @PutMapping
    public ProfileDto updateProfile(Authentication authentication,
                                    @Valid @RequestBody ProfileUpdateRequest request) {
        return profileService.updateProfile(authentication.getName(), request);
    }
}
