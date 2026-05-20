package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.AuthResponse;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.SignupRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       TokenService tokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
    }

    public AuthResponse signup(SignupRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new EmailAlreadyExistsException(request.email());
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole("USER");
        user.setEnabled(true);

        try {
            User savedUser = userRepository.save(user);
            String token = tokenService.generateToken(savedUser);
            return new AuthResponse(token);
        } catch (DataIntegrityViolationException ex) {
            // Race condition: another request registered the same email between our check and save.
            // The DB unique constraint on `email` prevents double registration — surface as 409.
            throw new EmailAlreadyExistsException(request.email());
        }
    }
}
