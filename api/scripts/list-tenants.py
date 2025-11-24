#!/usr/bin/env python3
import os, re, sys
import psycopg2

# Load .env if present
if os.path.exists('.env'):
    with open('.env') as f:
        for line in f:
            m = re.match(r'([A-Za-z_][A-Za-z0-9_]*)=(.*)', line.strip())
            if m and m.group(1) not in os.environ:
                os.environ[m.group(1)] = m.group(2)

url = os.environ.get('DATABASE_URL')
if not url:
    print('DATABASE_URL not set')
    sys.exit(1)

# Parse URL manually for psycopg2 if needed
# Format: postgresql://user:pass@host:port/db
m = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(\S+)', url)
if not m:
    print(f'Cannot parse DATABASE_URL: {url}')
    sys.exit(1)
user, password, host, port, db = m.groups()

conn = psycopg2.connect(dbname=db, user=user, password=password, host=host, port=port)
cur = conn.cursor()
cur.execute('SELECT id, name FROM "Tenant" ORDER BY "createdAt" ASC LIMIT 50;')
rows = cur.fetchall()
print('Tenants:')
for r in rows:
    print(f'{r[0]} | {r[1]}')
cur.close()
conn.close()
