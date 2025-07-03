import { ExtractedData, ListItemEvalResult, ProcessingResult } from "../scraper-engine-types.js";
import { Page } from "puppeteer";
import pLimit from "p-limit";
import { IScraperConfiguration } from "../models/scraperConfig.model.js";
import { getCurrentPoolOptions } from "../browserPooling/browserPoolInstancing.js";
import { initializeBrowserPool } from "../browserPooling/browserPoolInstancing.js";
import { DEFAULT_POOL_OPTIONS } from "../constants/browserPool.constants.js";
import { applyPageWait, closePopups } from "../utils/pagePreparation.js";
import { handleFixedScrollsInteraction, scrollToBottomUntilStable } from "../utils/pageScrolling.js";
import { handleLoadMoreButtonInteraction } from "../utils/loadMoreButtonInteraction.js";
import { takeScreenshot } from "../utils/screenshotPage.js";
import { BROWSER_PROCESS_LIST_ITEM_FUNCTION_STRING } from "../constants/processListFuncString.js";
import { MAX_DETAIL_PAGES_PER_JOB } from "../constants/puppeteer.constants.js";
import { processDetailPage } from "./detailPage.service.js";
import {handleIncrementalInfiniteScroll} from "../utils/incrementalScroll.js";


export async function processListPage(
    startUrl: string,
    config: IScraperConfiguration,
    processedDetailUrls: Set<string>
): Promise<ProcessingResult[]> {
    console.log(`[Service:processListPage] Processing List Page: ${startUrl}`);

    const pool = await initializeBrowserPool();
    let pageObj: { page: Page; browserId: string } | null = null;
    const finalResults: ProcessingResult[] = [];
    const intermediateListData: { [key: string]: { listData: ExtractedData, finalUrl: string } } = {};
    let itemEvalResults: ListItemEvalResult[] = [];

    try {
        pageObj = await pool.getPage(startUrl);
        const { page } = pageObj;
        const listPageUrl = page.url();

        await applyPageWait(page, config.pageLoadWaitOptions);
        await closePopups(page, config.closePopupSelectors);

        const interactionOpts = config.interactionOptions;
        const strategy = interactionOpts?.interactionStrategy;
        console.log(`[Service:processListPage] Applying interaction strategy: ${strategy || 'none'}`);

        switch (strategy) {
            case 'infiniteScroll':
                itemEvalResults = await handleIncrementalInfiniteScroll(page, config);
                break;

            case 'loadMoreButton':
                if (interactionOpts?.loadMoreButtonSelector) {
                    await handleLoadMoreButtonInteraction(page, {
                        loadMoreButtonSelector: interactionOpts.loadMoreButtonSelector,
                        maxClicks: interactionOpts.maxClicks ?? 5,
                        clickDelayMs: interactionOpts.clickDelayMs ?? 1500,
                        scrollDelayMs: interactionOpts.scrollDelayMs ?? 500,
                        scrollStagnationTimeoutMs: interactionOpts.scrollStagnationTimeoutMs ?? 3000,
                        maxScrolls: interactionOpts.maxScrolls ?? 20,
                        maxItemsToScrape: interactionOpts.maxItemsToScrape
                    }, config.itemSelector);
                }
                itemEvalResults = await page.$$eval(
                    config.itemSelector,
                    (elements, mappings, url, funcStr) => {
                        const processItemFunc = eval(`(${funcStr})`);
                        return elements.map(element => processItemFunc(element, mappings, url));
                    },
                    config.fieldMappings,
                    listPageUrl,
                    `(${BROWSER_PROCESS_LIST_ITEM_FUNCTION_STRING})`
                );
                break;

            case 'fixedScrolls':
                await handleFixedScrollsInteraction(page, {
                    maxScrolls: interactionOpts?.maxScrolls ?? 10,
                    scrollDelayMs: interactionOpts?.scrollDelayMs ?? 500
                });
                itemEvalResults = await page.$$eval(
                    config.itemSelector,
                    (elements, mappings, url, funcStr) => {
                        const processItemFunc = eval(`(${funcStr})`);
                        return elements.map(element => processItemFunc(element, mappings, url));
                    },
                    config.fieldMappings,
                    listPageUrl,
                    `(${BROWSER_PROCESS_LIST_ITEM_FUNCTION_STRING})`
                );
                break;

            case 'none':
            default:
                itemEvalResults = await page.$$eval(
                    config.itemSelector,
                    (elements, mappings, url, funcStr) => {
                        const processItemFunc = eval(`(${funcStr})`);
                        return elements.map(element => processItemFunc(element, mappings, url));
                    },
                    config.fieldMappings,
                    listPageUrl,
                    `(${BROWSER_PROCESS_LIST_ITEM_FUNCTION_STRING})`
                );
                break;
        }

        await takeScreenshot(page, config, 'list');

        for (const [index, itemResult] of itemEvalResults.entries()) {
            if (itemResult.error) continue;
            const { listData, detailUrl } = itemResult;
            const itemKey = detailUrl || `${listPageUrl}#item-${index}`;
            intermediateListData[itemKey] = { listData: listData || {}, finalUrl: itemKey };
        }

    } catch (error: any) {
        console.error(`[Service:processListPage] Critical error during list processing for ${startUrl}: ${error.message}`, error.stack);
    } finally {
        if (pageObj) {
            await pool.releasePage(pageObj.page);
            console.log(`[Service:processListPage] Released list page for ${startUrl}. Now processing detail tasks.`);
        }
    }

    const detailPageTasks: { url: string, task: Promise<ProcessingResult | null> }[] = [];
    const poolOptions = getCurrentPoolOptions() || DEFAULT_POOL_OPTIONS;
    const limit = pLimit(poolOptions.maxPoolSize);

    for (const key in intermediateListData) {
        if (config.scrapeDetailsFromList && key.startsWith('http')) {
            const detailUrl = key;
            if (processedDetailUrls.size >= MAX_DETAIL_PAGES_PER_JOB) continue;
            if (processedDetailUrls.has(detailUrl)) continue;

            processedDetailUrls.add(detailUrl);
            console.log(`[Service:processListPage] Queuing detail task for ${detailUrl}.`);
            const task = limit(() => processDetailPage(detailUrl, config));
            detailPageTasks.push({ url: detailUrl, task });
        }
    }

    if (detailPageTasks.length > 0) {
        console.log(`[Service:processListPage] Awaiting ${detailPageTasks.length} detail page tasks...`);
        const detailResultsArray = await Promise.all(detailPageTasks.map(t => t.task));
        const detailResultsMap: { [url: string]: ExtractedData } = {};
        detailResultsArray.forEach((result, i) => {
            if (result?.data) {
                detailResultsMap[detailPageTasks[i].url] = result.data;
            }
        });

        for (const key in intermediateListData) {
            const item = intermediateListData[key];
            const finalData = {
                listData: item.listData,
                detailData: detailResultsMap[key] || {}
            };
            finalResults.push({ url: item.finalUrl, data: finalData });
        }
    } else {
        for (const key in intermediateListData) {
            const item = intermediateListData[key];
            finalResults.push({ url: item.finalUrl, data: { listData: item.listData, detailData: {} } });
        }
    }

    console.log(`[Service:processListPage] Finished all processing for ${startUrl}. Returning ${finalResults.length} results.`);
    return finalResults;
}