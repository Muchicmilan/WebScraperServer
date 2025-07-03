import { Page } from "puppeteer";
import { IScraperConfiguration } from "../models/scraperConfig.model.js";
import { ListItemEvalResult } from "../scraper-engine-types.js";
import { BROWSER_PROCESS_LIST_ITEM_FUNCTION_STRING } from "../constants/processListFuncString.js";
import {humanLikeScrollToBottom, smoothScroll} from "./humanLikeScrolling.js";

export async function handleIncrementalInfiniteScroll(
    page: Page,
    config: IScraperConfiguration
): Promise<ListItemEvalResult[]> {
    const {
        maxScrolls = 20,
        scrollDelayMs = 1000,
        maxItemsToScrape,
        scrollAmount = 1000,
        maxEmptyScrolls = 3,
        contentLoadWaitMs = 2000,
    } = config.interactionOptions || {};

    const scrollDelayMin = Math.max(200, scrollDelayMs * 0.5);
    const scrollDelayMax = scrollDelayMs * 1.5;
    const allItems: ListItemEvalResult[] = [];
    const logPrefix = `[Utils:IncrementalScroll]`;
    let consecutiveEmptyScrolls = 0;

    console.log(`${logPrefix} Starting incremental scrape. Max scrolls: ${maxScrolls}, Delay: ${scrollDelayMs}ms`);

    for (let currentScroll = 0; currentScroll < maxScrolls; currentScroll++) {

        console.log(`${logPrefix} Scrolling down by ${scrollAmount}px...`);
        await humanLikeScrollToBottom(page, scrollAmount);

        const randomDelay = Math.floor(Math.random() * (scrollDelayMax - scrollDelayMin + 1) + scrollDelayMin);
        await new Promise(resolve => setTimeout(resolve, randomDelay));

        if (contentLoadWaitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, contentLoadWaitMs));
        }

        const newItems = await page.evaluate(
            (selector, mappings, url, funcStr) => {
                const processItemFunc = eval(funcStr);

                const newElements = Array.from(document.querySelectorAll(`${selector}:not([data-scraped="true"])`));

                if (newElements.length === 0) {
                    return [];
                }

                const results: ListItemEvalResult[] = [];
                for (const element of newElements) {
                    element.setAttribute('data-scraped', 'true');
                    results.push(processItemFunc(element, mappings, url));
                }
                return results;
            },
            config.itemSelector,
            config.fieldMappings,
            page.url(),
            `(${BROWSER_PROCESS_LIST_ITEM_FUNCTION_STRING})`
        );

        if (newItems.length > 0) {
            console.log(`${logPrefix} Scroll ${currentScroll + 1}: Found ${newItems.length} new items.`);
            allItems.push(...newItems);
            consecutiveEmptyScrolls = 0;
        } else {
            consecutiveEmptyScrolls++;
            console.log(`${logPrefix} Scroll ${currentScroll + 1}: No new items found. Empty scrolls: ${consecutiveEmptyScrolls}/${maxEmptyScrolls}`);

            if (consecutiveEmptyScrolls >= maxEmptyScrolls) {
                console.log(`${logPrefix} Reached maximum consecutive empty scrolls (${maxEmptyScrolls}). Assuming end of list.`);
                break;
            }
        }

        if (maxItemsToScrape && allItems.length >= maxItemsToScrape) {
            console.log(`${logPrefix} Reached item limit of ${maxItemsToScrape}. Stopping scroll.`);
            break;
        }

        const isAtBottom = await page.evaluate(() => {
            return window.innerHeight + window.scrollY >= document.body.scrollHeight - 100; // 100px buffer
        });

        if (isAtBottom) {
            console.log(`${logPrefix} Reached bottom of page.`);
            await new Promise(resolve => setTimeout(resolve, contentLoadWaitMs));

            const finalItems = await page.evaluate(
                (selector, mappings, url, funcStr) => {
                    const processItemFunc = eval(funcStr);
                    const newElements = Array.from(document.querySelectorAll(`${selector}:not([data-scraped="true"])`));

                    if (newElements.length === 0) {
                        return [];
                    }

                    const results: ListItemEvalResult[] = [];
                    for (const element of newElements) {
                        element.setAttribute('data-scraped', 'true');
                        results.push(processItemFunc(element, mappings, url));
                    }
                    return results;
                },
                config.itemSelector,
                config.fieldMappings,
                page.url(),
                `(${BROWSER_PROCESS_LIST_ITEM_FUNCTION_STRING})`
            );

            if (finalItems.length > 0) {
                console.log(`${logPrefix} Found ${finalItems.length} final items at page bottom.`);
                allItems.push(...finalItems);
            } else {
                console.log(`${logPrefix} No more content available at page bottom.`);
                break;
            }
        }
    }

    await page.evaluate((selector) => {
        document.querySelectorAll(`${selector}[data-scraped="true"]`).forEach(el => el.removeAttribute('data-scraped'));
    }, config.itemSelector);

    console.log(`${logPrefix} Finished incremental scroll. Total items found: ${allItems.length}`);

    if (maxItemsToScrape) {
        return allItems.slice(0, maxItemsToScrape);
    }



    return allItems;
}