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

-- Table for completed project actuals (real costs vs estimates)
CREATE TABLE IF NOT EXISTS ml_project_actuals (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    quote_id TEXT,
    lead_id TEXT,
    questionnaire_answers JSONB NOT NULL,
    supplier_quote_cost DECIMAL(10,2),
    client_estimate DECIMAL(10,2),
    client_order_value DECIMAL(10,2) NOT NULL,
    material_cost_actual DECIMAL(10,2),
    labor_hours_actual DECIMAL(8,2),
    labor_cost_actual DECIMAL(10,2),
    other_costs_actual DECIMAL(10,2),
    total_cost_actual DECIMAL(10,2),
    gross_profit_actual DECIMAL(10,2),
    gp_percent_actual DECIMAL(5,2),
    estimate_variance DECIMAL(10,2),
    cost_variance DECIMAL(10,2),
    completed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    CONSTRAINT check_gp_target CHECK (gp_percent_actual >= 0 AND gp_percent_actual <= 100)
);

CREATE INDEX IF NOT EXISTS idx_project_actuals_tenant ON ml_project_actuals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_actuals_quote ON ml_project_actuals(quote_id);
CREATE INDEX IF NOT EXISTS idx_project_actuals_completed ON ml_project_actuals(completed_at);

-- Table for tracking material cost history from uploaded/manual purchase orders
CREATE TABLE IF NOT EXISTS ml_material_costs (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    material_code TEXT,
    material_name TEXT,
    supplier_name TEXT,
    currency TEXT DEFAULT 'GBP',
    unit TEXT,
    unit_price DECIMAL(12,4) NOT NULL,
    previous_unit_price DECIMAL(12,4),
    price_change_percent DECIMAL(7,3),
    purchase_order_id TEXT, -- optional external reference
    captured_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_costs_tenant_material ON ml_material_costs(tenant_id, material_code);
CREATE INDEX IF NOT EXISTS idx_material_costs_supplier ON ml_material_costs(tenant_id, supplier_name);