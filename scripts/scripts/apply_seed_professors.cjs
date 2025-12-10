const fs = require('fs');
const path = require('path');
const http = require('http');

function postJson(url, obj) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(obj);
    const opts = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

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

    // Treat placeholder-like emails as missing so we don't upsert junk entries.
    const email = String(p.email || '').trim();
    if (!email || /not\s*(found|clearly found)/i.test(email)) {
      console.warn(`Skipping ${k}: missing or placeholder email (${p.email})`);
      continue;
    }

    // Resolve departmentId: prefer explicit departmentId; otherwise try to match
    // the human-readable `department` field against seed departments (case-insensitive).
    let resolvedDeptId = p.departmentId;
    if (!resolvedDeptId && p.department) {
      const deptNameLower = String(p.department).trim().toLowerCase();
      const match = (seed.departments || []).find(d => {
        if (!d) return false;
        const id = String(d.id || '').toLowerCase();
        const name = String(d.name || '').toLowerCase();
        return id === deptNameLower || name === deptNameLower || name.includes(deptNameLower) || deptNameLower.includes(id);
      });
      if (match) resolvedDeptId = match.id;
    }

    p.departmentId = resolvedDeptId || 'dept-ai';
    // Use explicit departmentName when available; otherwise pull from seed by id; fallback to any provided department string.
    const seedDept = (seed.departments || []).find(d => d.id === p.departmentId);
    p.departmentName = p.departmentName || (seedDept ? seedDept.name : (p.department || 'AI dept'));
    if (!p.branchName && p.branch) {
      const b = branches[p.branch];
      p.branchName = b && b.name ? b.name : (p.branch === 'branch-core-ai' ? 'Core AI' : p.branch);
    }

    try {
      const res = await postJson('http://localhost:4000/datas/update', p);
      if (res.status >= 200 && res.status < 300) {
        console.log(`Upserted ${k} -> ${p.email}`);
      } else {
        console.error(`Failed ${k}: ${res.status} ${res.body}`);
      }
    } catch (e) {
      console.error(`Request error for ${k}:`, e.message);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
