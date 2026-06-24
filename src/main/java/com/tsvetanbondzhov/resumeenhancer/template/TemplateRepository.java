package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TemplateRepository extends JpaRepository<ResumeTemplate, UUID> {

    List<ResumeTemplate> findAllByIsPublishedTrue();

    Optional<ResumeTemplate> findByIdAndIsPublishedTrue(UUID id);

    List<ResumeTemplate> findAllByOwnerId(UUID ownerId);

    Optional<ResumeTemplate> findByIdAndOwnerId(UUID id, UUID ownerId);
}
