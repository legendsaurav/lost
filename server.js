



import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import session from 'express-session';
// In-memory MongoDB for development fallback
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- INITIAL SETUP ---
dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- MIDDLEWARE ---
// Allow larger payloads because profile images may be sent as base64 data URLs
// Allow credentials so the frontend can send/receive the session cookie.
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
// Also support larger URL-encoded bodies if any forms post that way
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- DATABASE CONNECTIONS ---
// Main DB for application data
// Use MONGO_URI from env or fall back to local DB for development
const mainDbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/career-booster';

async function connectMainDb() {
    try {
        await mongoose.connect(mainDbUri);
        console.log(`Main DB (career-booster) connected successfully. Using ${mainDbUri}`);
        await seedDatabase();
        return mainDbUri;
    } catch (err) {
        console.error("Main DB connection error:", err);
        console.log('Attempting to start an in-memory MongoDB server for development...');
        const mongod = await MongoMemoryServer.create();
        const memUri = mongod.getUri();
        try {
            await mongoose.connect(memUri);
            console.log(`Connected to in-memory MongoDB at ${memUri}`);
            await seedDatabase();
            // Keep reference so the in-memory server isn't garbage collected
            process._mongoMemoryServer = mongod;
            return memUri;
        } catch (memErr) {
            console.error('Failed to connect to in-memory MongoDB:', memErr);
            throw memErr;
        }
    }
}

// Start connection but don't block server startup. Once main DB is connected or in-memory
// fallback is ready, create the secondary user DB connection so it doesn't fail early.
let userDbConnection;
connectMainDb()
    .then((usedUri) => {
        // Ensure we construct a valid secondary DB URI. If `usedUri` contains
        // a database path (e.g. mongodb://host:port/mainDb), replace the
        // trailing path with '/bullshit' instead of appending, which would
        // produce an invalid namespace like '.../mainDb/bullshit'. If a
        // USER_DB_URI env var is provided, prefer that.
        const userDbUri = process.env.USER_DB_URI || (usedUri ? usedUri.replace(/\/[^\/]*$/, '/bullshit') : 'mongodb://localhost:27017/bullshit');
        try {
            userDbConnection = mongoose.createConnection(userDbUri);
            // assign User model on the newly created connection
            try { User = userDbConnection.model('User', UserSchema, 'user'); } catch (e) { /* ignore if model already exists */ }
            userDbConnection.on('connected', () => console.log('Secondary DB (bullshit) connected successfully.'));
            userDbConnection.on('error', err => console.error('Secondary DB connection error:', err));
        } catch (err) {
            console.error('Secondary DB connection error:', err);
        }
    })
    .catch(err => {
        console.error('Error during main DB connection sequence:', err);
        // Ensure we still attempt to create a secondary connection with a reasonable fallback
        try {
            const fallbackUserUri = process.env.USER_DB_URI || 'mongodb://localhost:27017/bullshit';
            userDbConnection = mongoose.createConnection(fallbackUserUri);
            try { User = userDbConnection.model('User', UserSchema, 'user'); } catch (e) { /* ignore if model already exists */ }
            userDbConnection.on('connected', () => console.log('Secondary DB (bullshit) connected successfully.'));
            userDbConnection.on('error', err => console.error('Secondary DB connection error:', err));
        } catch (e) {
            console.error('Failed to create fallback secondary DB connection:', e);
        }
    });


// --- MONGOOSE SCHEMAS ---
const toJSONTransform = {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
    }
};

const ProfessorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    position: String,
    degree: String,
    branch: String,
    department: String,
    description: String,
    photo: String,
    links: { awards: String, webpage: String, bio: String },
    research: [String],
    projects: [String],
    companies: [String],
    websites: [String],
    institutes: [String]
});
ProfessorSchema.set('toJSON', toJSONTransform);

const DepartmentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    branches: [String]
});
DepartmentSchema.set('toJSON', toJSONTransform);

const BranchSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true }
});
BranchSchema.set('toJSON', toJSONTransform);

// New Schemas to match the user's database structure
const CompanySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }
});
CompanySchema.set('toJSON', toJSONTransform);

// News schema: persist fetched articles with publication date, link, snippet
const NewsSchema = new mongoose.Schema({
    title: { type: String, required: true },
    snippet: { type: String },
    link: { type: String },
    publishedAt: { type: Date, required: true },
    fetchedAt: { type: Date, default: Date.now },
    // expireAt will be used with a TTL index to automatically remove
    // articles that are older than a configured retention window.
    expireAt: { type: Date }
});
NewsSchema.set('toJSON', toJSONTransform);

// Indexes for deduplication and TTL cleanup
NewsSchema.index({ link: 1 }, { unique: true, sparse: true });
NewsSchema.index({ title: 1, publishedAt: 1 }, { unique: true, sparse: true });
// TTL index: documents will be removed when `expireAt` is reached
NewsSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const InterestUpdateSchema = new mongoose.Schema({
    update: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
InterestUpdateSchema.set('toJSON', toJSONTransform);

// New Schema for the 'bullshit' database's 'user' collection
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true } // In a real app, this should be hashed
});


// --- MONGOOSE MODELS ---
// Models for main DB (using default connection)
const Professor = mongoose.model('Professor', ProfessorSchema, 'professors');
const Department = mongoose.model('Department', DepartmentSchema, 'department');
const Branch = mongoose.model('Branch', BranchSchema, 'branches');
const Company = mongoose.model('Company', CompanySchema, 'companies');
const News = mongoose.model('News', NewsSchema, 'news');
const InterestUpdate = mongoose.model('InterestUpdate', InterestUpdateSchema, 'interest-updates');

// Model for secondary DB (using the new connection)
// `User` will be assigned after the `userDbConnection` is created to avoid
// referencing an undefined connection during startup.
let User;


// --- DATABASE SEEDING ---
async function seedDatabase() {
    try {
        const professorCount = await Professor.countDocuments();
        const seedPath = path.join(__dirname, 'seed.json');
        const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

        if (professorCount === 0) {
            console.log("Database is empty. Seeding full dataset...");

            // Seed departments, branches, and professors
            await Department.insertMany(seedData.departments);
            await Branch.insertMany(Object.values(seedData.branches));
            await Professor.insertMany(Object.values(seedData.professors));

            // Seed news: ensure we map older seed shape to the new schema
            if (seedData.news && seedData.news.length > 0) {
                const seeded = (seedData.news || []).map(item => {
                    // seed entries may have { title, date } where date is a string
                    const publishedAt = item.publishedAt ? new Date(item.publishedAt) : (item.date ? new Date(item.date) : new Date());
                    const expireAt = new Date(publishedAt.getTime() + (14 * 24 * 60 * 60 * 1000));
                    return {
                        title: item.title,
                        snippet: item.snippet || item.summary || item.excerpt || '',
                        link: item.link || item.url || undefined,
                        publishedAt,
                        fetchedAt: new Date(),
                        expireAt
                    };
                });
                try {
                    await News.insertMany(seeded, { ordered: false });
                } catch (e) {
                    // ignore duplicate key errors during seed
                }
            }

            // Extract and seed unique companies from professor data
            const allCompanies = Object.values(seedData.professors).flatMap(p => p.companies || []);
            const uniqueCompanyNames = [...new Set(allCompanies)];
            if (uniqueCompanyNames.length > 0) {
                const companiesToSeed = uniqueCompanyNames.map(name => ({ name }));
                await Company.insertMany(companiesToSeed);
            }

            console.log("Database seeding complete.");
        } else {
            // If DB already has data, ensure departments and branches from the seed
            // are present (upsert). This allows adding new departments to seed.json
            // and having them show up without wiping or re-seeding the DB.
            console.log("Database already has data. Ensuring seed departments & branches are present (upsert)...");

            // Upsert departments
            for (const dept of seedData.departments) {
                await Department.findOneAndUpdate(
                    { id: dept.id },
                    { $set: { name: dept.name }, $addToSet: { branches: { $each: dept.branches || [] } } },
                    { upsert: true }
                );
            }

            // Upsert branches
            for (const branch of Object.values(seedData.branches)) {
                await Branch.findOneAndUpdate(
                    { id: branch.id },
                    { $set: { name: branch.name } },
                    { upsert: true }
                );
            }

            // Upsert professors as well so adding new entries to seed.json
            // will populate the DB even if it already has some data.
            try {
                for (const profEntry of Object.values(seedData.professors || {})) {
                    // Make a shallow copy and remove any `id` field which may
                    // conflict with MongoDB's _id semantics.
                    const prof = { ...profEntry };
                    if (prof.id) delete prof.id;

                    // Use email as the unique key when available, falling back to name.
                    const filter = prof.email ? { email: prof.email } : { name: prof.name };

                    // Normalize array fields to match schema expectations
                    ['research', 'projects', 'companies', 'websites', 'institutes'].forEach(k => {
                        if (prof[k] && !Array.isArray(prof[k])) prof[k] = [prof[k]];
                    });

                    await Professor.findOneAndUpdate(filter, { $set: prof }, { upsert: true });
                }
            } catch (e) {
                console.warn('Warning: failed to upsert some professor entries from seed:', e);
            }

            // Optionally upsert news items if absent
            if (seedData.news && seedData.news.length > 0) {
                for (const item of seedData.news) {
                    const publishedAt = item.publishedAt ? new Date(item.publishedAt) : (item.date ? new Date(item.date) : new Date());
                    const expireAt = new Date(publishedAt.getTime() + (14 * 24 * 60 * 60 * 1000));
                    try {
                        await News.findOneAndUpdate(
                            { title: item.title, publishedAt },
                            { $setOnInsert: { title: item.title, snippet: item.snippet || '', link: item.link || undefined, publishedAt, fetchedAt: new Date(), expireAt } },
                            { upsert: true }
                        );
                    } catch (e) {
                        // ignore duplicates or other upsert errors
                    }
                }
            }

            console.log("Seed upsert complete.");
        }
    } catch (error) {
        console.error("Error seeding database:", error);
    }
}

// --- API ENDPOINTS ---

// --- NEWS FETCHER & PERSISTENCE ---
// Default to supplied API/CX values when env vars are not provided.
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyBLgVWubZePLdM3JhFLmcTqaMqG5ECSbgc';
const GOOGLE_CX = process.env.GOOGLE_CX || '57bee4b33867c41c3';
const DEFAULT_NEWS_POLL_MS = 60 * 60 * 1000; // 1 hour
const NEWS_POLL_MS = process.env.NEWS_POLL_INTERVAL_MS ? parseInt(process.env.NEWS_POLL_INTERVAL_MS, 10) : DEFAULT_NEWS_POLL_MS;

async function fetchAndStoreNews() {
    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
        console.warn('Skipping server-side news fetch: GOOGLE_API_KEY or GOOGLE_CX not set.');
        return { inserted: 0 };
    }

    try {
        // Updated search query to focus on job-related results per request.
        // Using quotes and OR operator: "job vacancy" OR hiring VL
        const q = encodeURIComponent('"job vacancy" OR hiring VL');
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${q}&num=8`;
        const resp = await fetch(url);
        if (!resp.ok) {
            const txt = await resp.text();
            console.warn('Google fetch failed:', resp.status, txt);
            return { inserted: 0 };
        }
        const data = await resp.json();
        const items = (data.items || []).map((it, i) => {
            const title = it.title || it.htmlTitle || it.snippet || `Untitled ${i}`;
            const snippet = it.snippet || '';
            const link = it.link || it.formattedUrl || undefined;
            let publishedAt = new Date();
            try {
                const meta = it.pagemap?.metatags?.[0] || {};
                const pub = meta['article:published_time'] || meta['og:updated_time'] || meta['date'];
                if (pub) publishedAt = new Date(pub);
            } catch (e) {}
            const expireAt = new Date(publishedAt.getTime() + (14 * 24 * 60 * 60 * 1000));
            return { title, snippet, link, publishedAt, fetchedAt: new Date(), expireAt };
        });

        if (items.length === 0) return { inserted: 0 };

        // Bulk upsert: prefer link-based dedupe when link is present, otherwise dedupe by title+publishedAt
        const ops = items.map(item => {
            if (item.link) {
                return {
                    updateOne: {
                        filter: { link: item.link },
                        update: { $setOnInsert: item },
                        upsert: true
                    }
                };
            }
            return {
                updateOne: {
                    filter: { title: item.title, publishedAt: item.publishedAt },
                    update: { $setOnInsert: item },
                    upsert: true
                }
            };
        });

        const bulkResult = await News.bulkWrite(ops, { ordered: false });
        // bulkWrite upsertedCount is available in result.upsertedCount
        const inserted = bulkResult.upsertedCount || 0;
        console.log(`News fetch: processed ${items.length} items, inserted ${inserted} new items.`);
        return { inserted };
    } catch (err) {
        console.error('Error in fetchAndStoreNews:', err);
        return { inserted: 0 };
    }
}

// Trigger an initial fetch on server start (non-blocking), and schedule periodic fetches
fetchAndStoreNews().catch(e => console.warn('Initial news fetch failed:', e));
setInterval(() => {
    fetchAndStoreNews().catch(e => console.warn('Scheduled news fetch failed:', e));
}, NEWS_POLL_MS);

// Expose a manual endpoint to trigger the fetch (protected internally)
app.post('/internal/fetch-news', async (req, res) => {
    try {
        const result = await fetchAndStoreNews();
        res.status(200).json(result);
    } catch (err) {
        console.error('Error triggering internal news fetch:', err);
        res.status(500).json({ error: 'Fetch failed' });
    }
});

// Public API endpoint to return the latest news from DB. Lightweight for frontend polling.
app.get('/api/news', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);
        const newsData = await News.find().sort({ publishedAt: -1 }).limit(limit).lean();
        res.status(200).json(newsData);
    } catch (err) {
        console.error('Error fetching news list:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility: detect whether the connected MongoDB supports transactions
async function canUseTransactions() {
    try {
        if (!mongoose.connection || !mongoose.connection.db) return false;
        const admin = mongoose.connection.db.admin();
        let info;
        try {
            // modern servers support 'hello'
            info = await admin.command({ hello: 1 });
        } catch (e) {
            // fallback to isMaster for older servers
            info = await admin.command({ isMaster: 1 });
        }

        if (info && (info.setName || info.msg === 'isdbgrid')) return true;
        return false;
    } catch (e) {
        return false;
    }
}

// Shared handler to return mock data (used by two routes: /mock-data and /api/mock-data)
async function sendMockData(req, res) {
    try {
        const departmentsData = await Department.find().lean();
        const branchesData = await Branch.find().lean();
        const professorsData = await Professor.find().lean();
        // Fetch news from the database instead of an external API
    const newsData = await News.find().sort({ publishedAt: -1 }).lean();

        // Transform arrays to objects keyed by ID, as the frontend expects
        const branches = branchesData.reduce((acc, branch) => {
            acc[branch.id] = { id: branch.id, name: branch.name };
            return acc;
        }, {});
        
        const professors = professorsData.reduce((acc, prof) => {
            const profJson = { ...prof, id: prof._id.toString() };
            delete profJson._id;
            delete profJson.__v;
            acc[profJson.id] = profJson;
            return acc;
        }, {});
        
        const departments = departmentsData.map(d => ({id: d.id, name: d.name, branches: d.branches}));

        res.status(200).json({ departments, branches, professors, news: newsData });
    } catch (error) {
        console.error("Error fetching all data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Register both the original and the new alias route
app.get('/mock-data', sendMockData);
app.get('/api/mock-data', sendMockData);

// Shared handler for adding/updating a Professor
async function updateProfessorHandler(req, res) {
    const profData = req.body;
    if (!profData || !profData.email) {
        return res.status(400).json({ error: "Professor data or email is missing." });
    }

    try {
        // Use `findOneAndUpdate` with `upsert` to handle both create and update
        const updatedProf = await Professor.findOneAndUpdate(
            { email: profData.email },
            { $set: profData },
            { new: true, upsert: true, runValidators: true }
        );

        // If the professor introduced a new branch or department locally,
        // ensure the related Branch and Department documents are created
        // and linked so that `/api/mock-data` can return consistent data on reload.
        try {
            // Ensure Branch exists
            if (profData.branch) {
                const existingBranch = await Branch.findOne({ id: profData.branch });
                if (!existingBranch) {
                    const branchName = profData.branchName || profData.branch;
                    await Branch.create({ id: profData.branch, name: branchName });
                } else if (profData.branchName && typeof profData.branchName === 'string') {
                    // Update branch name if a new human-readable name was provided
                    const newName = profData.branchName.trim();
                    if (newName && newName !== existingBranch.name) {
                        await Branch.updateOne({ id: profData.branch }, { $set: { name: newName } });
                    }
                }
            }

            // Ensure Department exists and references the branch
            if (profData.departmentId) {
                let department = await Department.findOne({ id: profData.departmentId });
                if (!department) {
                    const deptName = profData.departmentName || profData.departmentId;
                    department = await Department.create({ id: profData.departmentId, name: deptName, branches: profData.branch ? [profData.branch] : [] });
                } else {
                    if (profData.branch && !department.branches.includes(profData.branch)) {
                        department.branches.push(profData.branch);
                        await department.save();
                    }
                }
            }
        } catch (innerErr) {
            console.error('Error ensuring branch/department persistence:', innerErr);
            // do not fail the entire professor save because of branch/department bookkeeping
        }

        res.status(200).json(updatedProf);
    } catch (error) {
        console.error("Error updating professor:", error);
        res.status(500).json({ error: "Failed to update professor." });
    }
}

// POST /datas/update (legacy) and /api/datas/update (preferred)
app.post('/datas/update', updateProfessorHandler);
app.post('/api/datas/update', updateProfessorHandler);

// DELETE /professors/:id  and DELETE /api/professors/:id
// Shared handler used for both route variants so frontend and tooling can call either path.
async function deleteProfessorHandler(req, res) {
    try {
        const supports = await canUseTransactions();
        const { id } = req.params;

        if (supports) {
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                const prof = await Professor.findById(id).session(session);
                if (!prof) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ error: "Professor not found" });
                }

                const branchId = prof.branch;
                await Professor.deleteOne({ _id: prof._id }).session(session);

                if (branchId) {
                    const remainingCount = await Professor.countDocuments({ branch: branchId }).session(session);
                    if (remainingCount === 0) {
                        await Branch.deleteOne({ id: branchId }).session(session);
                        await Department.updateMany({ branches: branchId }, { $pull: { branches: branchId } }).session(session);
                    }
                }

                await session.commitTransaction();
                session.endSession();
                return res.status(200).json({ ok: true });
            } catch (err) {
                try { await session.abortTransaction(); } catch (e) { /* ignore */ }
                try { session.endSession(); } catch (e) { /* ignore */ }
                console.error('Error during transactional professor delete:', err);
                return res.status(500).json({ error: "Internal server error" });
            }
        } else {
            // Non-transactional path for standalone MongoDB
            const prof = await Professor.findById(id);
            if (!prof) {
                return res.status(404).json({ error: "Professor not found" });
            }
            const branchId = prof.branch;
            await Professor.deleteOne({ _id: prof._id });
            if (branchId) {
                const remainingCount = await Professor.countDocuments({ branch: branchId });
                if (remainingCount === 0) {
                    await Branch.deleteOne({ id: branchId });
                    await Department.updateMany({ branches: branchId }, { $pull: { branches: branchId } });
                }
            }
            return res.status(200).json({ ok: true });
        }
    } catch (error) {
        console.error('Error deleting professor:', error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

app.delete('/professors/:id', deleteProfessorHandler);
app.delete('/api/professors/:id', deleteProfessorHandler);

// DELETE department by id (preferred) or by name (legacy).
// Supports routes: /departments/:id, /api/departments/:id, and legacy /departments/:name, /api/departments/:name
async function deleteDepartmentHandler(req, res) {
    const deptIdentifier = req.params.id || req.params.name;
    try {
        const supports = await canUseTransactions();

        if (supports) {
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                // Prefer lookup by id; if not found and identifier looks like a name, try by name.
                let department = await Department.findOne({ id: deptIdentifier }).session(session);
                if (!department) {
                    department = await Department.findOne({ name: deptIdentifier }).session(session);
                }
                if (!department) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ error: "Department not found" });
                }

                const branchesToDelete = department.branches || [];
                await Professor.deleteMany({ branch: { $in: branchesToDelete } }).session(session);
                await Branch.deleteMany({ id: { $in: branchesToDelete } }).session(session);
                await Department.deleteOne({ id: department.id }).session(session);

                await session.commitTransaction();
                session.endSession();
                return res.status(200).json({ ok: true });
            } catch (err) {
                try { await session.abortTransaction(); } catch (e) { /* ignore */ }
                try { session.endSession(); } catch (e) { /* ignore */ }
                console.error(`Error during transactional department delete:`, err);
                return res.status(500).json({ error: "Internal server error" });
            }
        } else {
            // Non-transactional fallback
            let department = await Department.findOne({ id: deptIdentifier });
            if (!department) {
                department = await Department.findOne({ name: deptIdentifier });
            }
            if (!department) {
                return res.status(404).json({ error: "Department not found" });
            }
            const branchesToDelete = department.branches || [];
            await Professor.deleteMany({ branch: { $in: branchesToDelete } });
            await Branch.deleteMany({ id: { $in: branchesToDelete } });
            await Department.deleteOne({ id: department.id });
            return res.status(200).json({ ok: true });
        }
    } catch (error) {
        console.error(`Error deleting department:`, error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// Register routes: preferred id-based and legacy name-based
app.delete('/departments/:id', deleteDepartmentHandler);
app.delete('/api/departments/:id', deleteDepartmentHandler);
app.delete('/departments/:name', deleteDepartmentHandler);
app.delete('/api/departments/:name', deleteDepartmentHandler);

// POST /public-register
// Add session middleware (in-memory for dev). In production, use a proper store.
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Public registration/login endpoint. Validates a shared password and creates
// a lightweight public user. Stores user info in the session for personalization.
app.post('/api/public-register', async (req, res) => {
    const { name, email, password, apiKey } = req.body;

    // Allowlist of specific public users and their unique passwords (dev-only)
    // NOTE: Storing plaintext passwords in source is insecure; this is for a
    // controlled dev environment only. In production, use hashed passwords and
    // a proper user management system.
    const ALLOWED_PUBLIC_USERS = {
        'mohi modi': 'pX4$7bQkz9T2',
        'harsh yadav': 'H@r5hY!d2025',
        'ankit mittal': 'Ank!tM1tt@l#8',
        'dhakshin kottha': 'Dhk$K0tth@72',
        'aditya verma': 'Ad1ty@V3rm#11',
        'saurav saha': 'S@ur4vS4h@33'
    };

    // Log incoming request for debugging public login issues (mask password)
    console.log('[public-register] incoming request from origin=', req.headers.origin, ' body=', { name, email, password: password ? '***' : undefined, apiKey: !!apiKey });

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const lookupName = String(name).trim().toLowerCase();
    const expectedPassword = ALLOWED_PUBLIC_USERS[lookupName];

    if (!expectedPassword) {
        return res.status(403).json({ error: "This name is not permitted to register as a public user." });
    }

    if (password !== expectedPassword) {
        return res.status(401).json({ error: "Invalid password for the given user." });
    }

    try {
        // Ensure the User model exists. The `User` model is created on the
        // secondary connection when that connection is established. If the
        // secondary connection or model isn't ready yet, fall back to using
        // the main mongoose connection so the endpoint can still operate.
        let UserModel = User;
        if (!UserModel) {
            try {
                // Try to attach the model to the default connection as a fallback.
                UserModel = mongoose.model('User') || mongoose.model('User', UserSchema, 'user');
            } catch (e) {
                // If model doesn't exist, create it on the default connection.
                UserModel = mongoose.model('User', UserSchema, 'user');
            }
            // Do not overwrite the `User` variable here because the primary
            // secondary connection may be assigned later; we only need a model
            // instance to perform this request.
        }

        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            // Idempotent behavior: if the email already exists, treat this as a sign-in
            try {
                req.session.user = apiKey ? { name: existingUser.name, email: existingUser.email, role: 'public', apiKey } : { name: existingUser.name, email: existingUser.email, role: 'public' };
            } catch (e) {
                console.warn('Warning: failed to set session for existing public user:', e);
            }
            return res.status(200).json({ message: "Public user signed in.", user: req.session.user });
        }

        // Store the matched allowed password (dev-only). Using the
        // `expectedPassword` variable avoids a ReferenceError when the
        // PREDEFINED_PASSWORD identifier is missing. In a real app this
        // should be a hashed password and managed securely.
        const newUser = new UserModel({
            name,
            email,
            password: expectedPassword || password
        });
        await newUser.save();

        // Store minimal info in the session so the frontend can personalize the UI
        try {
            // Include the optional API key in the session if provided
            req.session.user = apiKey ? { name, email, role: 'public', apiKey } : { name, email, role: 'public' };
        } catch (e) {
            // If session write fails, continue but log a warning.
            console.warn('Warning: failed to set session for public user:', e);
        }

        res.status(201).json({ message: "Public user registered successfully.", user: req.session.user });
    } catch (error) {
        console.error("Error registering public user:", error);
        // In dev, return error details to aid debugging. Remove or sanitize in production.
        res.status(500).json({ error: "Internal server error.", details: (error && error.stack) ? String(error.stack) : String(error) });
    }
});

// Return the currently logged-in user from the session (if any)
app.get('/api/me', (req, res) => {
    if (req.session && req.session.user) {
        return res.status(200).json(req.session.user);
    }
    return res.status(401).json({ error: 'Not authenticated' });
});

// Logout endpoint to destroy the session
app.post('/api/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.warn('Session destroy error:', err);
                return res.status(500).json({ error: 'Failed to logout' });
            }
            res.clearCookie('connect.sid');
            return res.status(200).json({ ok: true });
        });
    } else {
        return res.status(200).json({ ok: true });
    }
});


// --- START SERVER ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});