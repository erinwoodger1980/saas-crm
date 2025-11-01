# ml/db_config.py
"""
Database configuration for ML service.
Optimized for shared database usage with connection pooling and query optimization.
"""

import os
import psycopg
from psycopg_pool import ConnectionPool
from typing import Optional, Dict, Any
import logging

class MLDatabaseManager:
    """
    Manages database connections for ML service with production optimizations.
    Designed to work safely alongside main application database usage.
    """
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Optional[ConnectionPool] = None
        self.logger = logging.getLogger(__name__)
        
    def initialize_pool(self):
        """Initialize connection pool with conservative settings for shared database."""
        try:
            self.pool = ConnectionPool(
                self.database_url,
                min_size=1,      # Minimal connections
                max_size=3,      # Conservative max to not overwhelm shared DB
                timeout=30,      # Reasonable timeout
                max_idle=300     # 5 minutes idle timeout
            )
            self.logger.info("ML database connection pool initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize database pool: {e}")
            raise
    
    def get_connection(self):
        """Get a database connection from the pool."""
        if not self.pool:
            self.initialize_pool()
        return self.pool.connection()
    
    def create_ml_tables(self):
        """Create ML-specific tables if they don't exist."""
        schema_sql = """
        -- ML Training Data Table
        CREATE TABLE IF NOT EXISTS ml_training_data (
            id SERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            email_subject TEXT,
            email_date TIMESTAMP,
            attachment_name TEXT,
            parsed_data JSONB NOT NULL,
            project_type TEXT,
            quoted_price DECIMAL(10,2),
            area_m2 DECIMAL(8,2),
            materials_grade TEXT,
            confidence DECIMAL(3,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Index for efficient querying
        CREATE INDEX IF NOT EXISTS idx_ml_training_tenant_date 
        ON ml_training_data(tenant_id, created_at);
        
        -- ML Model Metadata Table
        CREATE TABLE IF NOT EXISTS ml_models (
            id SERIAL PRIMARY KEY,
            model_name TEXT NOT NULL,
            model_type TEXT NOT NULL, -- 'price_prediction', 'win_probability', etc.
            version TEXT NOT NULL,
            tenant_id TEXT,
            training_data_count INTEGER,
            accuracy_score DECIMAL(5,4),
            model_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT FALSE
        );
        
        -- Training History Table
        CREATE TABLE IF NOT EXISTS ml_training_history (
            id SERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            training_type TEXT NOT NULL, -- 'email_batch', 'manual_upload', etc.
            quotes_processed INTEGER,
            training_records_created INTEGER,
            models_updated TEXT[], -- Array of model names updated
            duration_seconds INTEGER,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            status TEXT DEFAULT 'completed', -- 'running', 'completed', 'failed'
            error_message TEXT
        );
        """
        
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(schema_sql)
                    conn.commit()
            self.logger.info("ML database schema created/updated successfully")
        except Exception as e:
            self.logger.error(f"Failed to create ML schema: {e}")
            raise
    
    def save_training_data(self, training_records: list) -> int:
        """Save training data with batch insert for efficiency."""
        if not training_records:
            return 0
            
        insert_sql = """
        INSERT INTO ml_training_data 
        (tenant_id, email_subject, email_date, attachment_name, parsed_data, 
         project_type, quoted_price, area_m2, materials_grade, confidence)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.executemany(insert_sql, [
                        (
                            record['tenant_id'],
                            record['email_subject'],
                            record['email_date'],
                            record['attachment_name'],
                            record['parsed_data'],
                            record.get('project_type'),
                            record.get('quoted_price'),
                            record.get('area_m2'),
                            record.get('materials_grade'),
                            record.get('confidence', 0.0)
                        ) for record in training_records
                    ])
                    conn.commit()
                    return len(training_records)
        except Exception as e:
            self.logger.error(f"Failed to save training data: {e}")
            raise
    
    def get_training_data(self, tenant_id: str, limit: int = 1000) -> list:
        """Retrieve training data for model training."""
        query_sql = """
        SELECT tenant_id, parsed_data, project_type, quoted_price, area_m2, 
               materials_grade, confidence, created_at
        FROM ml_training_data 
        WHERE tenant_id = %s 
        ORDER BY created_at DESC 
        LIMIT %s
        """
        
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query_sql, (tenant_id, limit))
                    return cur.fetchall()
        except Exception as e:
            self.logger.error(f"Failed to retrieve training data: {e}")
            raise
    
    def cleanup(self):
        """Clean up database connections."""
        if self.pool:
            self.pool.close()
            self.logger.info("ML database pool closed")

# Global database manager instance
_db_manager: Optional[MLDatabaseManager] = None

def get_db_manager() -> MLDatabaseManager:
    """Get or create the global database manager."""
    global _db_manager
    if not _db_manager:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL environment variable not set")
        _db_manager = MLDatabaseManager(database_url)
        _db_manager.create_ml_tables()
    return _db_manager

# Alias for backwards compatibility
DatabaseManager = MLDatabaseManager