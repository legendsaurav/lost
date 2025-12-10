#!/usr/bin/env node
/**
 * Reconcile branches and departments for existing data.
 * - Ensures each Professor.branch has a corresponding Branch document.
 * - Ensures the professor's department contains that branch id in its branches array.
 *
 * Usage (PowerShell):
 *   node scripts/reconcile_branches.cjs
 *   # or with a custom Mongo URI
 *   $env:MONGO_URI="mongodb://localhost:27017/career-booster"; node scripts/reconcile_branches.cjs
 */
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/career-booster';

async function main() {
  console.log('[reconcile] Connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const Professor = mongoose.model('Professor', new mongoose.Schema({
    name: String,
    email: String,
    branch: String,
    department: String,
    // tolerate extra fields
  }, { strict: false }), 'professors');

  const Department = mongoose.model('Department', new mongoose.Schema({
    id: String,
    name: String,
    branches: [String]
  }), 'department');

  const Branch = mongoose.model('Branch', new mongoose.Schema({
    id: String,
    name: String
  }), 'branches');

  const profs = await Professor.find({}).lean();
  console.log(`[reconcile] Found ${profs.length} professors`);

  let createdBranches = 0, updatedDepartments = 0;

  for (const p of profs) {
    const branchId = (p.branch || '').trim();
    if (!branchId) continue;

    // 1) Ensure Branch exists
    let br = await Branch.findOne({ id: branchId });
    if (!br) {
      const nameGuess = (p.branchName && String(p.branchName).trim()) || branchId;
      try {
        await Branch.create({ id: branchId, name: nameGuess });
        createdBranches++;
        console.log(`[reconcile] Created missing Branch { id: "${branchId}", name: "${nameGuess}" } for professor ${p.name}`);
      } catch (e) {
        console.warn('[reconcile] Failed to create Branch', branchId, e.message);
      }
    }

    // 2) Ensure Department contains this branch
    let dept = null;
    if (p.department) {
      dept = await Department.findOne({ name: p.department });
    }

    // If dept is still not found, try to discover by existing membership
    if (!dept) {
      dept = await Department.findOne({ branches: branchId });
    }

    if (dept) {
      if (!Array.isArray(dept.branches)) dept.branches = [];
      if (!dept.branches.includes(branchId)) {
        dept.branches.push(branchId);
        try { await dept.save(); updatedDepartments++; } catch(e) { console.warn('[reconcile] Failed to save Department', dept.id, e.message); }
      }
    }
  }

  console.log(`[reconcile] Done. Created ${createdBranches} branches; updated ${updatedDepartments} departments.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error('[reconcile] Fatal error:', err); process.exitCode = 1; });
