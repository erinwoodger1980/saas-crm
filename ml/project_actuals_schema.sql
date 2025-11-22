-- ml/project_actuals_schema.sql
-- Schema for tracking completed project actuals for ML learning

-- Table for completed project actuals
CREATE TABLE IF NOT EXISTS ml_project_actuals (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    quote_id TEXT, -- Link to Quote table in main DB
    lead_id TEXT, -- Link to Lead table
    
    -- Customer questionnaire responses
    questionnaire_answers JSONB NOT NULL,
    
    -- Pricing journey
    supplier_quote_cost DECIMAL(10,2), -- What supplier charged
    client_estimate DECIMAL(10,2), -- What we quoted to client
    client_order_value DECIMAL(10,2) NOT NULL, -- What client actually paid (the truth)
    
    -- Actual costs (the reality check)
    material_cost_actual DECIMAL(10,2), -- Real material/purchase order costs
    labor_hours_actual DECIMAL(8,2), -- Real hours worked (from timesheets)
    labor_cost_actual DECIMAL(10,2), -- Real labor costs
    other_costs_actual DECIMAL(10,2), -- Transport, subcontractors, etc.
    
    -- Calculated metrics
    total_cost_actual DECIMAL(10,2), -- Sum of all actual costs
    gross_profit_actual DECIMAL(10,2), -- Order value - total costs
    gp_percent_actual DECIMAL(5,2), -- (gross profit / order value) * 100
    
    -- Variance analysis
    estimate_variance DECIMAL(10,2), -- client_order_value - client_estimate
    cost_variance DECIMAL(10,2), -- material_cost_actual - supplier_quote_cost
    
    -- Metadata
    completed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    
    -- Constraints
    CONSTRAINT check_gp_target CHECK (gp_percent_actual >= 0 AND gp_percent_actual <= 100)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_project_actuals_tenant ON ml_project_actuals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_actuals_quote ON ml_project_actuals(quote_id);
CREATE INDEX IF NOT EXISTS idx_project_actuals_completed ON ml_project_actuals(completed_at);
CREATE INDEX IF NOT EXISTS idx_project_actuals_gp ON ml_project_actuals(gp_percent_actual) WHERE gp_percent_actual IS NOT NULL;

-- View for quick project performance summary
CREATE OR REPLACE VIEW ml_project_performance AS
SELECT 
    tenant_id,
    COUNT(*) as total_projects,
    AVG(gp_percent_actual) as avg_gp_percent,
    AVG(estimate_variance) as avg_estimate_variance,
    AVG(cost_variance) as avg_cost_variance,
    SUM(client_order_value) as total_revenue,
    SUM(gross_profit_actual) as total_profit,
    COUNT(CASE WHEN gp_percent_actual >= 40 THEN 1 END) as projects_hitting_target,
    COUNT(CASE WHEN gp_percent_actual < 30 THEN 1 END) as projects_underperforming
FROM ml_project_actuals
GROUP BY tenant_id;

COMMENT ON TABLE ml_project_actuals IS 'Real completed project data for ML training - the source of truth for pricing accuracy';
COMMENT ON COLUMN ml_project_actuals.supplier_quote_cost IS 'Supplier invoice amount (what we paid suppliers)';
COMMENT ON COLUMN ml_project_actuals.client_estimate IS 'Our initial quote to client';
COMMENT ON COLUMN ml_project_actuals.client_order_value IS 'Final agreed price - the ML target';
COMMENT ON COLUMN ml_project_actuals.material_cost_actual IS 'Sum of all purchase orders for this job';
COMMENT ON COLUMN ml_project_actuals.labor_cost_actual IS 'Hours worked * hourly rate from timesheets';
COMMENT ON COLUMN ml_project_actuals.gp_percent_actual IS 'Target is 40% - tracks how well we estimated';
