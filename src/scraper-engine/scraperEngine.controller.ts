import { Router } from "express";
import {
    handleCreateConfiguration, handleDeleteConfiguration,
    handleGetAllConfigurations,
    handleGetConfigurationById, handleUpdateConfiguration
} from "./handlers/scraperConfiguration.handlers.js";
import {handleRunMultipleScrapeJobs, handleRunScrapeJob} from "./handlers/scrapeJob.handlers.js";
import {handleGetScrapedData, handleGetScrapedItemById} from "./handlers/scrapedData.handlers.js";
import {handleGetEngineSettings, handleUpdateEngineSettings} from "./handlers/scraperEngineSettings.handlers.js";
import {handleCreateAccount, handleGetAccounts} from "./handlers/accounts.handler.js";
import {runMultipleScrapeJobs} from "./service/scraperJob.service.js";


const scrapeEngineRouter = Router();

scrapeEngineRouter.post("/configurations", handleCreateConfiguration);
scrapeEngineRouter.get("/configurations", handleGetAllConfigurations);
scrapeEngineRouter.get("/configurations/:id", handleGetConfigurationById);
scrapeEngineRouter.put("/configurations/:id", handleUpdateConfiguration);
scrapeEngineRouter.delete("/configurations/:id", handleDeleteConfiguration);

scrapeEngineRouter.get("/engine-settings", handleGetEngineSettings);
scrapeEngineRouter.put("/engine-settings", handleUpdateEngineSettings);
scrapeEngineRouter.post("/accounts", handleCreateAccount);
scrapeEngineRouter.get("/accounts", handleGetAccounts);

scrapeEngineRouter.post("/scrape-jobs/:configId/run", handleRunScrapeJob);
scrapeEngineRouter.post("/scrape-jobs/run-multiple", handleRunMultipleScrapeJobs);
scrapeEngineRouter.get("/scraped-data", handleGetScrapedData);
scrapeEngineRouter.get("/scraped-data/:itemId", handleGetScrapedItemById);


export default scrapeEngineRouter;