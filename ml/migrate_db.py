#!/usr/bin/env python3
# ml/migrate_db.py
"""
ML Database Migration Script
Initializes the ML database schema for the joineryai_shadow database
"""

import os
import sys
import psycopg
from pathlib import Path

def get_database_url():
    """Get database URL from environment"""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    return db_url

def run_migrations():
    """Run database migrations"""
    db_url = get_database_url()
    
    print("🗄️  Connecting to ML database...")
    try:
        conn = psycopg.connect(db_url)
        cursor = conn.cursor()
        print("✅ Database connection successful")
        
        # Read schema file
        schema_path = Path(__file__).parent / "schema.sql"
        if not schema_path.exists():
            print("❌ ERROR: schema.sql file not found")
            sys.exit(1)
        
        print("📝 Running database migrations...")
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        # Execute schema creation
        cursor.execute(schema_sql)
        conn.commit()
        
        # Verify tables were created
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE 'ml_%'
        """)
        tables = cursor.fetchall()
        
        print(f"✅ Created {len(tables)} ML tables:")
        for table in tables:
            print(f"   - {table[0]}")
        
        cursor.close()
        conn.close()
        print("🎉 Database migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Database migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()