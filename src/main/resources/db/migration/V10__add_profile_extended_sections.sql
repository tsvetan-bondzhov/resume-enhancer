-- V10: Add profile extended section tables for certifications, languages, projects, volunteering.
-- DDL only — no data changes.

CREATE TABLE profile_certifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    issuer          VARCHAR(255),
    issue_date      DATE,
    expiration_date DATE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_languages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    proficiency_level VARCHAR(50) NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_projects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    technologies VARCHAR(255),
    link         VARCHAR(255),
    start_date   DATE,
    end_date     DATE,
    is_current   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_volunteering (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    role         VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    description  TEXT,
    start_date   DATE,
    end_date     DATE,
    is_current   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
