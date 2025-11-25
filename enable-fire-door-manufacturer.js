#!/usr/bin/env node

/**
 * Enable fire door manufacturer flag for LAJ Joinery
 */

const https = require('https');

const SESSION_COOKIE = process.env.SESSION_COOKIE || '';

if (!SESSION_COOKIE) {
  console.error('❌ SESSION_COOKIE environment variable not set');
  console.error('\nUsage:');
  console.error('  SESSION_COOKIE="your-cookie-here" node enable-fire-door-manufacturer.js');
  process.exit(1);
}

async function enableFireDoorFlag() {
  console.log('Enabling fire door manufacturer flag...\n');

  // First get tenant settings
  const options = {
    hostname: 'joineryai.app',
    path: '/settings',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `joinery_session=${SESSION_COOKIE}`,
    }
  };

  const data = JSON.stringify({
    isFireDoorManufacturer: true
  });

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}\n`);
        
        if (res.statusCode === 200) {
          console.log('✅ Fire door manufacturer flag enabled!');
          console.log('You can now use the fire door schedule.');
          resolve(responseData);
        } else {
          console.error(`❌ Failed with status ${res.statusCode}`);
          console.error('Response:', responseData);
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

enableFireDoorFlag()
  .then(() => {
    console.log('\n✅ Done! Reload the fire door schedule page.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });
