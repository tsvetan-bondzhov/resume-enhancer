CREATE TABLE profiles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    summary    TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_work_experiences (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    job_title  VARCHAR(255),
    company    VARCHAR(255),
    start_date DATE,
    end_date   DATE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_education (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id     UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    institution    VARCHAR(255),
    degree         VARCHAR(255),
    field_of_study VARCHAR(255),
    start_date     DATE,
    end_date       DATE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_skills (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
