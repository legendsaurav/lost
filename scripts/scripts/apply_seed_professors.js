const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

async function main() {
  const root = path.resolve(__dirname, '..');
  const seedPath = path.join(root, 'seed.json');
  if (!fs.existsSync(seedPath)) {
    console.error('seed.json not found');
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const profs = seed.professors || {};
  const branches = seed.branches || {};
  const keys = Object.keys(profs).filter(k => k.startsWith('prof-'));
  if (keys.length === 0) {
    console.log('No prof- entries found in seed.json to apply.');
    return;
  }

  for (const k of keys) {
    const p = { ...profs[k] };
    // Ensure required identifiers for server upsert logic
    if (!p.email) {
      console.warn(`Skipping ${k}: missing email`);
      continue;
    }
    // Provide departmentId/departmentName and branchName so server will create them if needed.
    // If `branch` is a branch id, look up its human name from seed.branches so the server receives a proper branchName.
    p.departmentId = p.departmentId || 'dept-ai';
    p.departmentName = p.departmentName || (p.department || 'AI dept');
    // derive branchName from seed.branches when possible
    if (!p.branchName && p.branch) {
      const b = branches[p.branch];
      p.branchName = b && b.name ? b.name : (p.branch === 'branch-core-ai' ? 'Core AI' : p.branch);
    }

    try {
      const res = await fetch('http://localhost:4000/datas/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const body = await res.text();
      if (res.ok) {
        console.log(`Upserted ${k} -> ${p.email}`);
      } else {
        console.error(`Failed ${k}: ${res.status} ${body}`);
      }
    } catch (e) {
      console.error(`Request error for ${k}:`, e.message);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
