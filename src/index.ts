import dotenv from "dotenv";
dotenv.config();
import express, {Application} from "express";
import cors from "cors";
import { connectDB } from "./database.js"
import { initializeCronJobs, stopAllJobs } from "./scraper-engine/cron/cronScheduling.js";
import mongoose from "mongoose";
import {initializeBrowserPool, shutdownBrowserPool} from "./scraper-engine/browserPooling/browserPoolInstancing.js";
import scrapeEngineRouter from "./scraper-engine/scraperEngine.controller.js";


const app: Application = express();
const PORT = process.env.PORT

app.use(cors());
app.use(express.json());

connectDB();

app.use("/api", scrapeEngineRouter);

await initializeBrowserPool();
await initializeCronJobs();

app.listen(PORT, ()=>{
    console.log(`server is listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server and services');
    try{
    stopAllJobs();
    await shutdownBrowserPool();
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
    }catch(err){
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server and services');
     try {
        stopAllJobs();
        await shutdownBrowserPool();
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
        process.exit(0);
    } catch (err) {
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
    }
});