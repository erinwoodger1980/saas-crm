#!/usr/bin/env node
const fetch = require('node-fetch');

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:4000';
  const token = process.env.API_TOKEN || '';
  try {
    const res = await fetch(`${baseUrl}/workshop/backfill-assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('Backfill request failed:', e?.message || e);
    process.exitCode = 1;
  }
}

main();
