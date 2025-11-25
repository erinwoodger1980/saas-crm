#!/usr/bin/env node

/**
 * One-time sync of fire door projects to opportunities
 * Run this after deployment completes
 */

const https = require('https');

async function triggerSync() {
  console.log('Triggering fire door to opportunities sync...\n');

  const options = {
    hostname: 'joineryai.app',
    path: '/fire-door-schedule/sync-to-opportunities',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Note: In production, this would need proper authentication
      // For now, we'll call it via an authenticated admin session
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          const result = JSON.parse(data);
          console.log('✅ Sync completed successfully!\n');
          console.log('Summary:');
          console.log(`  Total projects: ${result.summary.total}`);
          console.log(`  Created: ${result.summary.created}`);
          console.log(`  Updated: ${result.summary.updated}`);
          console.log(`  Skipped: ${result.summary.skipped}`);
          resolve(result);
        } else {
          console.error(`❌ Sync failed with status ${res.statusCode}`);
          console.error(data);
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

// Check if we're being run directly
if (require.main === module) {
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
      console.error('\nNote: Make sure you are authenticated and the API is deployed.');
      process.exit(1);
    });
}

module.exports = { triggerSync };
