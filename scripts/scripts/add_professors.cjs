#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 4) + '\n', 'utf8');
}

function writeSeedTs(filePath, jsonObj) {
  const content = `// AUTO-GENERATED from seed.json - do not edit by hand\n` +
    `export const fallbackData = ${JSON.stringify(jsonObj, null, 4)};\n\nexport default fallbackData;\n`;
  fs.writeFileSync(filePath, content, 'utf8');
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function makeProf(idNum, branchId) {
  const firstNames = ['Aisha','Carlos','Deepa','Ethan','Fatima','Gopal','Hannah','Ibrahim','Jia','Kofi','Lina','Mateo','Nadia','Omar','Priya','Quentin','Ravi','Sofia','Tariq','Uma','Valeria','Wei','Xander','Yara','Zane'];
  const lastNames = ['Patel','Singh','Kumar','Sharma','Gupta','Smith','Johnson','Wang','Garcia','Silva','Nguyen','Ali','Khan','Brown','Jones'];
  const fn = firstNames[idNum % firstNames.length];
  const ln = lastNames[idNum % lastNames.length];
  const name = `Prof. ${fn} ${ln}`;
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${idNum}@univ.edu`;
  const photo = `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;
  const branchesMap = {
    'branch-ai': { dept: 'Computer Science', branchName: 'Artificial Intelligence' },
    'branch-systems': { dept: 'Computer Science', branchName: 'Systems' },
    'branch-theory': { dept: 'Physics', branchName: 'Theoretical Physics' }
  };
  const meta = branchesMap[branchId] || { dept: 'Computer Science', branchName: 'General' };

  return {
    id: `prof${idNum}`,
    branch: branchId,
    name,
    photo,
    degree: 'Ph.D.',
    position: 'Assistant Professor',
    department: meta.dept,
    email,
    links: { awards: '#', webpage: '#', bio: '#' },
    research: ['Research Area 1', 'Research Area 2'],
    description: `Researcher in ${meta.branchName}.`,
    details: `Office: ${100 + idNum}A.`,
    projects: ['Project A'],
    companies: []
  };
}

function main() {
  const cwd = path.resolve(__dirname, '..');
  const seedPath = path.join(cwd, 'seed.json');
  const seedTsPath = path.join(cwd, 'seed.ts');

  if (!fs.existsSync(seedPath)) {
    console.error('seed.json not found in project root.');
    process.exit(1);
  }

  const seed = readJSON(seedPath);
  const branches = Object.keys(seed.branches || {});
  if (branches.length === 0) {
    console.error('No branches found in seed.json. Please ensure seed.json has a "branches" object.');
    process.exit(1);
  }

  const argN = process.argv[2];
  const N = argN ? parseInt(argN, 10) : 5;
  if (!Number.isFinite(N) || N <= 0) {
    console.error('Please provide a positive integer N.');
    process.exit(1);
  }

  // Determine next available numeric id (prof1, prof2, ...)
  const existing = Object.keys(seed.professors || {});
  let maxNum = 0;
  existing.forEach(k => {
    const m = k.match(/prof(\d+)$/i);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });

  for (let i = 1; i <= N; i++) {
    const idNum = maxNum + i;
    const branchId = pick(branches, idNum - 1);
    const prof = makeProf(idNum, branchId);
    seed.professors = seed.professors || {};
    seed.professors[`prof${idNum}`] = prof;
  }

  writeJSON(seedPath, seed);
  writeSeedTs(seedTsPath, seed);

  console.log(`Added ${N} professors to seed.json and updated seed.ts (prof${maxNum+1}..prof${maxNum+N}).`);
}

if (require.main === module) main();
