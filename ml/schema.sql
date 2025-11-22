-- ml/schema.sql
-- ML Service Database Schema for joineryai_shadow database

-- Table for storing ML training data from email quotes
CREATE TABLE IF NOT EXISTS ml_training_data (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email_subject TEXT,
    email_date TIMESTAMP,
    attachment_name TEXT,
    parsed_data JSONB,
    questionnaire_answers JSONB,
    project_details JSONB,
    quoted_price DECIMAL(10,2),
    confidence DECIMAL(3,2),
    source_type TEXT DEFAULT 'client_quote', -- 'supplier_quote' or 'client_quote' - determines if markup needed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient tenant-based queries
CREATE INDEX IF NOT EXISTS idx_ml_training_data_tenant_id ON ml_training_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ml_training_data_created_at ON ml_training_data(created_at);
CREATE INDEX IF NOT EXISTS idx_ml_training_data_source_type ON ml_training_data(tenant_id, source_type);

-- Table for storing model metadata and performance metrics
CREATE TABLE IF NOT EXISTS ml_models (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    model_type TEXT NOT NULL, -- 'price', 'win_probability', etc.
    model_version TEXT NOT NULL,
    model_path TEXT,
    performance_metrics JSONB,
    training_data_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE
);

-- Index for model lookups
CREATE INDEX IF NOT EXISTS idx_ml_models_tenant_type ON ml_models(tenant_id, model_type);
CREATE INDEX IF NOT EXISTS idx_ml_models_active ON ml_models(tenant_id, model_type, is_active) WHERE is_active = TRUE;

-- Table for tracking training jobs
CREATE TABLE IF NOT EXISTS ml_training_jobs (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    job_type TEXT NOT NULL, -- 'email_discovery', 'model_training', etc.
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    parameters JSONB,
    results JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for job tracking
CREATE INDEX IF NOT EXISTS idx_ml_training_jobs_tenant_status ON ml_training_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ml_training_jobs_created_at ON ml_training_jobs(created_at);

-- Table for email service configurations (encrypted credentials)
CREATE TABLE IF NOT EXISTS ml_email_configs (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE,
    email_provider TEXT NOT NULL, -- 'gmail', 'm365'
    encrypted_credentials TEXT, -- Encrypted JSON blob
    last_sync_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for email config lookups
CREATE INDEX IF NOT EXISTS idx_ml_email_configs_tenant ON ml_email_configs(tenant_id) WHERE is_active = TRUE;