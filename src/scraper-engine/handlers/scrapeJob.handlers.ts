import {Request, Response} from "express";
import mongoose from "mongoose";
import {initializeBrowserPool} from "../browserPooling/browserPoolInstancing.js";
import {runScrapeJob, runMultipleScrapeJobs} from "../service/scraperJob.service.js";
import {ScraperConfigurationModel} from "../models/scraperConfig.model.js";

export const handleRunScrapeJob = async (req: Request, res: Response): Promise<void> => {
    const { configId } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(configId)) {
            res.status(400).json({ error: "Invalid Configuration ID format." });
            return;
        }
        const config = await ScraperConfigurationModel.findById(configId).lean();
        if (!config) {
            res.status(404).json({ error: "Configuration not found." });
            return;
        }

        await initializeBrowserPool();

        runScrapeJob(config).then(results => {
            console.log(`[API Handler Callback] Background job ${config.name} (${configId}) finished. Final results count: ${results?.length}.`);
        }).catch(error => {
            console.error(`[API Handler Callback] Background job ${config.name} (${configId}) failed:`, error.message);
        });

        console.log(`[API Handler] Accepted scrape job request for '${config.name}' (${configId}).`)
        res.status(202).json({ success: true, message: `Scrape job '${config.name}' accepted and started in background.` });

    } catch (error: any) {
        console.error(`[API Handler] Error initiating job for config ${configId}:`, error.message);
        res.status(500).json({ error: `Failed to initiate scrape job: ${error.message}` });
    }
};

export const handleRunMultipleScrapeJobs = async (req: Request, res: Response): Promise<void> => {
    const { configIds } = req.body;

    if (!Array.isArray(configIds) || configIds.length === 0) {
        res.status(400).json({ error: "Request body must contain a non-empty 'configIds' array." });
        return;
    }

    const invalidIds = configIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        res.status(400).json({ error: `Invalid Configuration ID format found: ${invalidIds.join(', ')}` });
        return;
    }

    try {
        const configs = await ScraperConfigurationModel.find({
            '_id': { $in: configIds }
        }).lean();

        const foundIds = configs.map(c => c._id.toString());
        const notFoundIds = configIds.filter(id => !foundIds.includes(id));

        if (notFoundIds.length > 0) {
            res.status(404).json({ error: `Configurations not found: ${notFoundIds.join(', ')}` });
            return;
        }
        if (configs.length === 0) {
            res.status(404).json({ error: `No configurations found for the provided IDs.` });
            return;
        }


        await initializeBrowserPool();

        runMultipleScrapeJobs(configs).then(summary => {
            console.log(`[API Handler Callback] Background multiple jobs finished. Summary:`, summary);
        }).catch(error => {
            console.error(`[API Handler Callback] Background multiple job runner failed critically:`, error.message);
        });

        console.log(`[API Handler] Accepted request to run ${configs.length} scrape jobs in background.`);
        res.status(202).json({
            success: true,
            message: `Accepted request to run ${configs.length} scrape job(s) in background.`,
            jobs_requested: configIds,
            jobs_found: foundIds
        });

    } catch (error: any) {
        console.error(`[API Handler] Error initiating multiple jobs:`, error.message);
        res.status(500).json({ error: `Failed to initiate multiple scrape jobs: ${error.message}` });
    }
};