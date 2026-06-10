package com.tsvetanbondzhov.resumeenhancer.profile.domain;

import com.tsvetanbondzhov.resumeenhancer.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "profile_volunteering")
@Getter
@Setter
public class Volunteering extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "profile_id", nullable = false)
    private Profile profile;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "organization", nullable = false)
    private String organization;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "is_current", nullable = false)
    private boolean isCurrent = false;
}
