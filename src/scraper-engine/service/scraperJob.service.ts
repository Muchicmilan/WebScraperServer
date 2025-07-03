import {ProcessingResult} from "../scraper-engine-types.js";
import mongoose from "mongoose";
import {ScrapedDataItemModel} from "../models/scrapedDataItem.model.js";
import {IScraperConfiguration} from "../models/scraperConfig.model.js";
import {initializeBrowserPool} from "../browserPooling/browserPoolInstancing.js";
import {MAX_DETAIL_PAGES_PER_JOB} from "../constants/puppeteer.constants.js";
import {processDetailPage} from "./detailPage.service.js";
import {processListPage} from "./listPage.service.js";
import {checkStructuredDataForKeywords} from "../utils/keywordDetection.js";
import {handleLogin} from "../utils/loginHelper.js";
import {AccountModel} from "../models/account.model.js";
import {Page} from "puppeteer";

async function saveResultsToDB(resultsToSave: ProcessingResult[], configId: mongoose.Types.ObjectId): Promise<number> {
    let savedCount = 0;
    let errorCount = 0;
    if (resultsToSave.length === 0) {
        console.log(`[Service:saveResults] No items to save for config ${configId}.`);
        return 0;
    }
    console.log(`[Service:saveResults] Saving/Updating ${resultsToSave.length} items to DB for config ${configId}...`);


    const bulkOps = resultsToSave.map(result => ({
        updateOne: {
            filter: { configId: configId, url: result.url },
            update: {
                $set: { data: result.data, scrapedAt: new Date() },
                $setOnInsert: { createdAt: new Date(), configId: configId, url: result.url }
            },
            upsert: true
        }
    }));

    try {
        const bulkResult = await ScrapedDataItemModel.bulkWrite(bulkOps, { ordered: false });
        savedCount = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);
        if (bulkResult.hasWriteErrors()) {
            errorCount = bulkResult.getWriteErrors().length;
            console.warn(`[Service:saveResults] Encountered ${errorCount} errors during bulk save for config ${configId}.`);
            console.error(bulkResult.getWriteErrors());
        }
    } catch (dbError: any) {
        console.error(`[Service:saveResults] Critical DB Error during bulk save for config ${configId}:`, dbError.message);
        errorCount = resultsToSave.length - savedCount;
    }
    console.log(`[Service:saveResults] Finished saving for config ${configId}. Saved/Updated: ${savedCount}, Errors: ${errorCount}`);
    return savedCount;
}

export async function runScrapeJob(config: IScraperConfiguration): Promise<ProcessingResult[]> {
    console.log(`[Service:runScrapeJob] Starting job: ${config.name} (${config._id}), Type: ${config.pageType}`);

    const processedDetailUrls = new Set<string>();
    let allExtractedResults: ProcessingResult[] = [];

    try {
        // If login is required, we must get a page just to log in, then release it.
        // The shared cookies will persist in the browser instance for other pages to use.
        if (config.loginConfig?.requiresLogin && config.loginConfig.accountId) {
            console.log(`[Service:runScrapeJob] Job requires login. Performing login once to set cookies.`);
            const pool = await initializeBrowserPool();
            let loginPageObj: { page: Page; browserId: string } | null = null;
            try {
                loginPageObj = await pool.getPage();
                const account = await AccountModel.findById(config.loginConfig.accountId);
                if (!account) throw new Error(`Account with ID ${config.loginConfig.accountId} not found.`);

                // Use the loginUrl from the config for the login attempt
                await loginPageObj.page.goto(config.loginConfig.loginUrl!, { waitUntil: 'networkidle2' });
                await handleLogin(loginPageObj.page, account, config.loginConfig);

                console.log(`[Service:runScrapeJob] Login complete, cookies are now set for this browser instance.`);
            } finally {
                if (loginPageObj) {
                    await pool.releasePage(loginPageObj.page);
                    console.log(`[Service:runScrapeJob] Login page released.`);
                }
            }
        }

        const startUrlPromises: Promise<ProcessingResult[]>[] = [];
        console.log(`[Service:runScrapeJob] Processing ${config.startUrls.length} start URL(s) for ${config.name}...`);

        for (const startUrl of config.startUrls) {
            console.log(`[Service:runScrapeJob] --- Queueing Start URL: ${startUrl} for job ${config.name} ---`);

            let promise: Promise<ProcessingResult[]>;
            if (config.pageType === 'DetailPage') {
                promise = processDetailPage(startUrl, config).then(result => result ? [result] : []);
            } else { // ListPage
                promise = processListPage(startUrl, config, processedDetailUrls);
            }
            startUrlPromises.push(promise);
        }

        console.log(`[Service:runScrapeJob] Waiting for ${startUrlPromises.length} start URL processing branches...`);
        const resultsArrays = await Promise.all(startUrlPromises);
        resultsArrays.forEach(results => allExtractedResults.push(...results));

    } catch (jobError: any) {
        console.error(`[Service:runScrapeJob] Critical job error for ${config.name}: ${jobError.message}`, jobError.stack);
    }

    let filteredResults = allExtractedResults;
    if (config.keywordsToFilterBy && config.keywordsToFilterBy.length > 0) {
        console.log(`[Service:runScrapeJob:${config.name}] Filtering ${allExtractedResults.length} results by keywords...`);
        filteredResults = allExtractedResults.filter(result =>
            checkStructuredDataForKeywords(result.data, config.keywordsToFilterBy!)
        );
        console.log(`[Service:runScrapeJob:${config.name}] ${filteredResults.length} items passed keyword filter.`);
    } else {
        console.log(`[Service:runScrapeJob:${config.name}] No keyword filter. Proceeding with ${allExtractedResults.length} items.`);
    }

    if (!mongoose.Types.ObjectId.isValid(config._id as mongoose.Types.ObjectId)) {
        console.error(`[Service:runScrapeJob:${config.name}] Invalid config._id (${config._id}). Cannot save results.`);
    } else {
        const configObjectId = config._id as mongoose.Types.ObjectId;
        await saveResultsToDB(filteredResults, configObjectId);
    }

    console.log(`[Service:runScrapeJob] Job ${config.name} finished. Results collected/filtered: ${filteredResults.length}. Detail URLs processed in this job: ${processedDetailUrls.size}`);
    return filteredResults;
}

export async function runMultipleScrapeJobs(
    configs: IScraperConfiguration[]
): Promise<Map<string, { success: boolean; resultsCount: number; message?: string }>> {
    const pool = await initializeBrowserPool();
    const resultsSummary = new Map<string, { success: boolean; resultsCount: number; message?: string }>();
    const configIds = configs.map(c => (c._id as mongoose.Types.ObjectId).toString());

    console.log(`[Service:runMultipleScrapeJobs] Starting ${configs.length} scrape jobs concurrently. Config IDs: [${configIds.join(', ')}]`);
    console.log(`[Service:runMultipleScrapeJobs] Using Browser Pool Stats:`, pool.getStats());

    const jobPromises = configs.map(async (config) => {
        const configID = config._id as mongoose.Types.ObjectId;
        const configIdStr = configID.toString();
        try {
            const jobResults = await runScrapeJob(config);
            resultsSummary.set(configIdStr, {
                success: true,
                resultsCount: jobResults.length,
                message: `Job ${config.name} completed successfully.`
            });
        } catch (error: any) {
            console.error(`[Service:runMultipleScrapeJobs] UNEXPECTED critical failure in job ${config.name} (${configIdStr}): ${error.message}`, error.stack);
            resultsSummary.set(configIdStr, {
                success: false,
                resultsCount: 0,
                message: `Job ${config.name} failed critically: ${error.message}`
            });
        }
    });

    await Promise.all(jobPromises);

    console.log(`[Service:runMultipleScrapeJobs] All ${configs.length} jobs finished processing.`);
    console.log(`[Service:runMultipleScrapeJobs] Final Browser Pool Stats:`, pool.getStats());

    configIds.forEach(id => {
        if (!resultsSummary.has(id)) {
            resultsSummary.set(id, { success: false, resultsCount: 0, message: "Job execution did not complete or record results." });
        }
    });


    return resultsSummary;
}