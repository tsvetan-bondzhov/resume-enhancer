CREATE TABLE resumes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    template_id    UUID NULL,
    name           VARCHAR(255) NOT NULL,
    resume_content JSONB NOT NULL DEFAULT '{}',
    is_tailored    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_id ON resumes (user_id);
