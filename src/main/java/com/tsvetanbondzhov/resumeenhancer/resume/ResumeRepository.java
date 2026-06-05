package com.tsvetanbondzhov.resumeenhancer.resume;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.Resume;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ResumeRepository extends JpaRepository<Resume, UUID> {
    List<Resume> findAllByUser(User user);
    Optional<Resume> findByIdAndUser(UUID id, User user);
}
