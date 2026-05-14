CREATE TABLE resume_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    is_prebuilt         BOOLEAN NOT NULL DEFAULT FALSE,
    is_published        BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id            UUID REFERENCES users (id) ON DELETE SET NULL,
    template_definition JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
