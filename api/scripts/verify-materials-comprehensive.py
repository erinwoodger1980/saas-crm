#!/usr/bin/env python3
"""Verify comprehensive material import including MaterialItem table"""

import os
import sys
import psycopg2

def load_env():
    """Load .env file manually"""
    env_paths = ['.env', '../.env', '../../.env', 'api/.env']
    for env_path in env_paths:
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key] = value.strip('"').strip("'")
            return
    raise FileNotFoundError("Could not find .env file")

# Load environment
load_env()

DATABASE_URL = os.getenv('DATABASE_URL')
TENANT_ID = 'cmi57aof70000itdhlazqjki7'

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Count MaterialItem records by category
    print(f"\nMaterialItem records for tenant {TENANT_ID}:")
    cursor.execute("""
        SELECT category, COUNT(*) 
        FROM "MaterialItem" 
        WHERE "tenantId" = %s 
        GROUP BY category
        ORDER BY category
    """, (TENANT_ID,))
    
    categories = cursor.fetchall()
    total_materials = sum(cat[1] for cat in categories)
    
    for category, count in categories:
        print(f"  {category}: {count}")
    
    print(f"  TOTAL: {total_materials}")
    
    # Show sample items from each category
    print("\n" + "="*80)
    print("SAMPLE ITEMS BY CATEGORY")
    print("="*80)
    
    for category, _ in categories:
        print(f"\n{category} (top 5 by cost):")
        cursor.execute("""
            SELECT name, cost, unit, description
            FROM "MaterialItem"
            WHERE "tenantId" = %s AND category = %s
            ORDER BY cost DESC
            LIMIT 5
        """, (TENANT_ID, category))
        
        items = cursor.fetchall()
        for name, cost, unit, desc in items:
            desc_str = f" ({desc[:50]}...)" if desc and len(desc) > 50 else f" ({desc})" if desc else ""
            print(f"  £{cost}/{unit} - {name}{desc_str}")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
