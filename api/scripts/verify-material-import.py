#!/usr/bin/env python3
import os, re, sys
import psycopg2

# Load .env
if os.path.exists('.env'):
    with open('.env') as f:
        for line in f:
            m = re.match(r'([A-Za-z_][A-Za-z0-9_]*)=(.*)', line.strip())
            if m and m.group(1) not in os.environ:
                os.environ[m.group(1)] = m.group(2)

url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/postgres')
m = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(\S+)', url)
if not m:
    print(f'Cannot parse DATABASE_URL: {url}')
    sys.exit(1)
user, password, host, port, db = m.groups()

tenant_id = sys.argv[1] if len(sys.argv) > 1 else 'cmi57aof70000itdhlazqjki7'

conn = psycopg2.connect(dbname=db, user=user, password=password, host=host, port=port)
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM "DoorCore" WHERE "tenantId" = %s;', (tenant_id,))
core_count = cur.fetchone()[0]
print(f'DoorCore records for tenant {tenant_id}: {core_count}')

cur.execute('SELECT code, name, "unitCost", "fireRating" FROM "DoorCore" WHERE "tenantId" = %s ORDER BY "unitCost" DESC LIMIT 10;', (tenant_id,))
print('\nTop 10 door cores by cost:')
for row in cur.fetchall():
    print(f'  {row[0][:30]:30s} | {row[1][:40]:40s} | £{row[2]:>8} | {row[3]}')

cur.execute('SELECT COUNT(*) FROM "IronmongeryItem" WHERE "tenantId" = %s;', (tenant_id,))
iron_count = cur.fetchone()[0]
print(f'\nIronmongeryItem records for tenant {tenant_id}: {iron_count}')

cur.execute('SELECT category, code, name, "unitCost" FROM "IronmongeryItem" WHERE "tenantId" = %s LIMIT 10;', (tenant_id,))
print('\nIronmongery items:')
for row in cur.fetchall():
    print(f'  {row[0]:15s} | {row[1][:30]:30s} | {row[2][:40]:40s} | £{row[3]}')

cur.close()
conn.close()
