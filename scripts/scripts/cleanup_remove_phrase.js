#!/usr/bin/env node
/**
 * One-off script to remove a specific unwanted phrase from professor documents.
 * Usage:
 *   node scripts/cleanup_remove_phrase.js
 * Or set MONGO_URI env var to point to your MongoDB instance.
 */
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/career-booster';
const TARGET_PHRASE = 'Machine Learning, Spatio-Temporal Modeling, Bayesian Methods, Climate Sciences';

async function run() {
  console.log('Connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const ProfessorSchema = new mongoose.Schema({}, { strict: false });
  const Professor = mongoose.model('Professor', ProfessorSchema, 'professors');

  try {
    const docs = await Professor.find({ $or: [ { description: new RegExp(TARGET_PHRASE) }, { research: TARGET_PHRASE }, { research: { $elemMatch: { $regex: TARGET_PHRASE } } } ] }).lean();
    console.log(`Found ${docs.length} professor(s) containing the target phrase.`);

    for (const doc of docs) {
      const updates = {};
      if (doc.description && typeof doc.description === 'string' && doc.description.includes(TARGET_PHRASE)) {
        updates.description = doc.description.replace(TARGET_PHRASE, '').trim();
      }

      if (doc.research) {
        if (Array.isArray(doc.research)) {
          updates.research = doc.research.map(r => typeof r === 'string' ? r.replace(TARGET_PHRASE, '').trim() : r).filter(Boolean);
        } else if (typeof doc.research === 'string' && doc.research.includes(TARGET_PHRASE)) {
          updates.research = doc.research.replace(TARGET_PHRASE, '').trim();
        }
      }

      if (Object.keys(updates).length > 0) {
        await Professor.updateOne({ _id: doc._id }, { $set: updates });
        console.log(`Updated professor ${doc._id}:`, updates);
      }
    }

    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
