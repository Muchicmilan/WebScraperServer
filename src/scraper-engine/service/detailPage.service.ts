import {ProcessingResult} from "../scraper-engine-types.js";
import {Page} from "puppeteer";
import {IScraperConfiguration} from "../models/scraperConfig.model.js";
import {initializeBrowserPool} from "../browserPooling/browserPoolInstancing.js";
import {applyPageWait, closePopups} from "../utils/pagePreparation.js";
import {takeScreenshot} from "../utils/screenshotPage.js";
import {extractDetailData} from "../utils/dataExtraction.js";

export async function processDetailPage(
    url: string, // REVERTED: No longer accepts a page object
    config: IScraperConfiguration
): Promise<ProcessingResult | null> {
    console.log(`[Service:processDetailPage] Processing Detail Page: ${url}`);

    const pool = await initializeBrowserPool();
    let pageObj: { page: Page; browserId: string } | null = null;

    try {
        pageObj = await pool.getPage(url);
        const { page } = pageObj;

        await applyPageWait(page, config.pageLoadWaitOptions);
        await closePopups(page, config.closePopupSelectors);
        await takeScreenshot(page, config, 'detail');
        const extractedData = await extractDetailData(page, config);

        if (extractedData && Object.keys(extractedData).length > 0) {
            console.log(`[Service:processDetailPage] Successfully extracted data for ${url}`);
            return { url: page.url(), data: extractedData };
        } else {
            console.warn(`[Service:processDetailPage] No data extracted from ${url}.`);
            await takeScreenshot(page, config, 'detail-no-data');
            return null;
        }

    } catch (error: any) {
        console.error(`[Service:processDetailPage] Failed for ${url}: ${error.message}`);
        return null;
    } finally {
        if (pageObj) {
            await pool.releasePage(pageObj.page);
        }
    }
}