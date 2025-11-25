#!/usr/bin/env node

/**
 * Trigger fire door to opportunities sync via authenticated API call
 */

const https = require('https');

// You need to get your session cookie from the browser
// 1. Log into joineryai.app as LAJ Joinery admin
// 2. Open DevTools > Application > Cookies
// 3. Copy the 'joinery_session' cookie value
// 4. Paste it here:
const SESSION_COOKIE = process.env.SESSION_COOKIE || '';

if (!SESSION_COOKIE) {
  console.error('❌ SESSION_COOKIE environment variable not set');
  console.error('\nUsage:');
  console.error('  SESSION_COOKIE="your-cookie-here" node trigger-sync-authenticated.js');
  console.error('\nTo get your session cookie:');
  console.error('  1. Log into joineryai.app as LAJ Joinery admin');
  console.error('  2. Open DevTools > Application > Cookies');
  console.error('  3. Copy the "joinery_session" cookie value');
  process.exit(1);
}

async function triggerSync() {
  console.log('Triggering fire door to opportunities sync...\n');

  const options = {
    hostname: 'joineryai.app',
    path: '/fire-door-schedule/sync-to-opportunities',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `joinery_session=${SESSION_COOKIE}`,
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}\n`);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const result = JSON.parse(data);
            console.log('✅ Sync completed successfully!\n');
            console.log('Summary:');
            console.log(`  Total projects: ${result.summary.total}`);
            console.log(`  Created: ${result.summary.created}`);
            console.log(`  Updated: ${result.summary.updated}`);
            console.log(`  Skipped: ${result.summary.skipped}\n`);
            
            if (result.results && result.results.length > 0) {
              console.log('First few results:');
              result.results.slice(0, 5).forEach(r => {
                console.log(`  - ${r.project}: ${r.status}${r.opportunityId ? ' (opp: ' + r.opportunityId + ')' : ''}`);
              });
            }
            
            resolve(result);
          } catch (e) {
            console.error('Failed to parse response:', data);
            reject(new Error('Invalid JSON response'));
          }
        } else {
          console.error(`❌ Sync failed with status ${res.statusCode}`);
          console.error('Response:', data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.end();
  });
}

console.log('Fire Door Schedule → Opportunities Sync');
console.log('========================================\n');
console.log('This will create won opportunities for all fire door projects.');
console.log('Each opportunity will have:');
console.log('  - Stage: WON');
console.log('  - Start Date: signOffDate (manufacture start)');
console.log('  - Delivery Date: approxDeliveryDate\n');

triggerSync()
  .then(() => {
    console.log('\n✅ All done! Fire door projects are now linked to won opportunities.');
    console.log('They will appear in the workshop schedule.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  });
