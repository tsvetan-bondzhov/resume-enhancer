package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Entity
@Table(name = "resumes")
@Getter
@Setter
@NoArgsConstructor
public class Resume extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "template_id")
    private UUID templateId;

    @Column(name = "name", nullable = false)
    private String name;

    @Convert(converter = ResumeDocumentConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "resume_content", columnDefinition = "jsonb", nullable = false)
    private ResumeDocument resumeContent;

    @Column(name = "is_tailored", nullable = false)
    private boolean isTailored;
}
