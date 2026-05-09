const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

// Read the migration SQL
const sql = fs.readFileSync(__dirname + '/migration.sql', 'utf8')
  // Remove comments and empty lines for cleaner execution
  .split('\n')
  .filter(line => !line.trim().startsWith('--') && line.trim())
  .join('\n');

const projectRef = 'jajfahyuglhbftphsktk';
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

// Method 1: Try Management API
function tryManagementApi() {
  return new Promise((resolve) => {
    const data = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/sql`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log('Management API:', res.statusCode, body);
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', (e) => {
      console.log('Management API error:', e.message);
      resolve(null);
    });
    req.write(data);
    req.end();
  });
}

// Method 2: Try using the service key as bearer token on the project SQL endpoint
function tryProjectSqlEndpoint() {
  return new Promise((resolve) => {
    const data = JSON.stringify({ query: sql });
    const options = {
      hostname: `${projectRef}.supabase.co`,
      path: `/auth/v1/admin/sql`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log('Project SQL:', res.statusCode, body);
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', (e) => {
      console.log('Project SQL error:', e.message);
      resolve(null);
    });
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Attempting to run migration SQL...\n');
  
  let result = await tryManagementApi();
  if (result && result.status === 200) {
    console.log('\n✓ Migration successful via Management API!');
    return;
  }
  
  result = await tryProjectSqlEndpoint();
  if (result && result.status === 200) {
    console.log('\n✓ Migration successful via Project SQL endpoint!');
    return;
  }
  
  console.log('\n✗ Could not run SQL automatically.');
  console.log('Please run the migration manually:');
  console.log('1. Go to https://supabase.com/dashboard/project/jajfahyuglhbftphsktk/sql/new');
  console.log('2. Open the file: ' + __dirname + '/migration.sql');
  console.log('3. Copy ALL the content');
  console.log('4. Paste it into the SQL editor');
  console.log('5. Click "Run"');
}

run().catch(console.error);
