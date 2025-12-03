import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://saas_crm_user:fRdJrD6Sxg1f8yYM6Lj36DUq7hXzDc79@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/saas_crm',
  ssl: { rejectUnauthorized: false }
});

async function addCoachingColumn() {
  try {
    console.log('Connecting to production database...');
    
    const sql = `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'TenantSettings' 
              AND column_name = 'isGroupCoachingMember'
          ) THEN
              ALTER TABLE "TenantSettings" 
              ADD COLUMN "isGroupCoachingMember" BOOLEAN NOT NULL DEFAULT false;
              RAISE NOTICE 'Column isGroupCoachingMember added successfully';
          ELSE
              RAISE NOTICE 'Column isGroupCoachingMember already exists';
          END IF;
      END $$;
    `;
    
    const result = await pool.query(sql);
    console.log('✅ Migration completed successfully');
    console.log(result);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addCoachingColumn();
