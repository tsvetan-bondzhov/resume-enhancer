package com.tsvetanbondzhov.resumeenhancer.template.domain;

import com.tsvetanbondzhov.resumeenhancer.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "resume_templates")
@Getter
@Setter
@NoArgsConstructor
public class ResumeTemplate extends BaseEntity {

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "is_prebuilt", nullable = false)
    private boolean isPrebuilt;

    @Column(name = "is_published", nullable = false)
    private boolean isPublished;

    @Column(name = "owner_id")
    private UUID ownerId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "template_definition", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> templateDefinition;
}
