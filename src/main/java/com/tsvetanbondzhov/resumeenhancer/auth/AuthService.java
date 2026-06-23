package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.AuthResponse;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.LoginRequest;
import com.tsvetanbondzhov.resumeenhancer.auth.dto.SignupRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    /**
     * Pre-computed BCrypt hash of a dummy value used to equalize response time when
     * the requested email does not exist, preventing a timing side-channel oracle.
     */
    private static final String DUMMY_HASH =
            "$2a$10$7EqJtq98hPqEX7fNZaFWoOe2Hs0CXcQPqRIuEqV9xKP1C6N3aU6Im";

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

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseGet(() -> {
                    // Perform a dummy password check to equalize response time and
                    // prevent a timing oracle that reveals whether an email exists.
                    passwordEncoder.matches(request.password(), DUMMY_HASH);
                    throw new InvalidCredentialsException();
                });

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        // Block login for deactivated accounts. Checked AFTER password verification so
        // it cannot be used as an account-existence/active-state oracle by an attacker.
        if (!user.isEnabled()) {
            throw new AccountDeactivatedException();
        }

        String token = tokenService.generateToken(user);
        return new AuthResponse(token);
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
