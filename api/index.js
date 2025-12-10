import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import session from 'express-session';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: 'https://ideal-carnival-legendsauravs-projects.vercel.app/', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const mainDbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/career-booster';

async function connectMainDb() {
    try {
        await mongoose.connect(mainDbUri);
        console.log(`Main DB (career-booster) connected successfully. Using ${mainDbUri}`);
        // await seedDatabase(); // If you have a seed function, import and call it here
        return mainDbUri;
    } catch (err) {
        console.error("Main DB connection error:", err);
        console.log('Attempting to start an in-memory MongoDB server for development...');
        const mongod = await MongoMemoryServer.create();
        const memUri = mongod.getUri();
        try {
            await mongoose.connect(memUri);
            console.log(`Connected to in-memory MongoDB at ${memUri}`);
            // await seedDatabase(); // If you have a seed function, import and call it here
            process._mongoMemoryServer = mongod;
            return memUri;
        } catch (memErr) {
            console.error('Failed to connect to in-memory MongoDB:', memErr);
            throw memErr;
        }
    }
}

connectMainDb();

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

export default app;
