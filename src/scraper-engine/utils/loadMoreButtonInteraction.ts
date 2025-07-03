import puppeteer, {Page} from "puppeteer";
import {IInteractionOptions} from "../models/interactionOptions.model.js";

export async function handleLoadMoreButtonInteraction(
    page: Page,
    options: Required<Pick<IInteractionOptions, 'loadMoreButtonSelector' | 'maxClicks' | 'clickDelayMs' | 'scrollDelayMs' | 'scrollStagnationTimeoutMs' >> // Use main scroll delays here
        & Pick<IInteractionOptions, 'maxItemsToScrape' | 'maxScrolls'>, // Optional limits
    itemSelector: string
): Promise<number> {
    const {
        loadMoreButtonSelector,
        maxClicks,
        clickDelayMs,
        scrollDelayMs,
        scrollStagnationTimeoutMs,
        maxScrolls,
        maxItemsToScrape
    } = options;

    const logPrefix = `[Utils:handleLoadMoreButton | ${page.url()}]`;
    let clicksMade = 0;
    const safetyMaxScrolls = maxScrolls ?? 20;

    console.log(`${logPrefix} Starting "Load More Button" interaction. Max clicks: ${maxClicks}, Button: "${loadMoreButtonSelector}", Click Delay: ${clickDelayMs}ms, Max Items: ${maxItemsToScrape ?? 'Unlimited'}`);

    let previousItemCount = -1;
    try {
        previousItemCount = await page.$$eval(itemSelector, els => els.length);
        console.log(`${logPrefix} Initial item count: ${previousItemCount}`);
    } catch (e: any) {
        console.warn(`${logPrefix} Could not get initial item count for selector "${itemSelector}": ${e.message}. Stagnation check might be less reliable.`);
        previousItemCount = -1;
    }

    for (let clickAttempt = 0; clickAttempt < maxClicks; clickAttempt++) {
        console.log(`${logPrefix} --- Starting Click Attempt ${clickAttempt + 1} / ${maxClicks} ---`);
        let currentItemCountBeforeClick = -1;
        let button: puppeteer.ElementHandle | null = null;
        let buttonFoundAndVisible = false;

        try {
            currentItemCountBeforeClick = await page.$$eval(itemSelector, els => els.length);
            console.log(`${logPrefix} Current item count before finding button: ${currentItemCountBeforeClick}`);
            if (maxItemsToScrape !== undefined && maxItemsToScrape > 0 && currentItemCountBeforeClick >= maxItemsToScrape) {
                console.log(`${logPrefix} Reached item limit (${currentItemCountBeforeClick}/${maxItemsToScrape}). Stopping.`);
                break;
            }
            console.log(`${logPrefix} Starting scroll cycle to find button "${loadMoreButtonSelector}" (Max scrolls: ${safetyMaxScrolls})...`);
            let scrollsInCycle = 0;
            let lastHeight = 0;
            let currentHeight = 0;
            let stableCount = 0;
            const requiredStableCount = Math.ceil((scrollStagnationTimeoutMs ?? 3000) / (scrollDelayMs ?? 500));

            while (scrollsInCycle < safetyMaxScrolls) {
                button = await page.$(loadMoreButtonSelector);
                if (button && await button.isIntersectingViewport()) {
                    console.log(`${logPrefix} Button found and visible after ${scrollsInCycle} scrolls this cycle.`);
                    buttonFoundAndVisible = true;
                    break;
                }
                if(button) {
                    await button.dispose();
                    button = null;
                }
                lastHeight = await page.evaluate(() => document.body.scrollHeight);

                console.log(`${logPrefix} Scrolling down (Scroll ${scrollsInCycle + 1}/${safetyMaxScrolls})...`); // Verbose
                await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
                scrollsInCycle++;

                await new Promise(resolve => setTimeout(resolve, scrollDelayMs ?? 500));

                currentHeight = await page.evaluate(() => document.body.scrollHeight);

                if (currentHeight === lastHeight) {
                    stableCount++;
                    console.log(`${logPrefix} Height stable (${currentHeight}). Stable count: ${stableCount}/${requiredStableCount}`);
                    if (stableCount >= requiredStableCount) {
                        console.log(`${logPrefix} Page height stabilized after ${scrollsInCycle} scrolls, button still not visible. Stopping scroll cycle.`);
                        break;
                    }
                } else {
                    stableCount = 0;
                }
            }

            if (scrollsInCycle >= safetyMaxScrolls) {
                console.log(`${logPrefix} Reached max scroll limit (${safetyMaxScrolls}) while searching for button.`);
            }

            if (!buttonFoundAndVisible) {
                button = await page.$(loadMoreButtonSelector);
                if (button && await button.isIntersectingViewport()) {
                    console.log(`${logPrefix} Button became visible just after scroll stabilization check.`);
                    buttonFoundAndVisible = true;
                } else {
                    console.log(`${logPrefix} Button "${loadMoreButtonSelector}" NOT found or not visible after scroll cycle. Stopping clicks.`);
                    if (button) await button.dispose();
                    break;
                }
            }

            console.log(`${logPrefix} Clicking button "${loadMoreButtonSelector}" (Click ${clicksMade + 1}/${maxClicks})...`);
            try {
                await button!.click();
                clicksMade++;
            } catch (clickError: any) {
                console.error(`${logPrefix} Error clicking button: ${clickError.message}. Stopping clicks.`);
                await button!.dispose();
                break;
            }
            await button!.dispose();

            console.log(`${logPrefix} Waiting ${clickDelayMs}ms after click...`);
            await new Promise(resolve => setTimeout(resolve, clickDelayMs));

            const currentItemCountAfterWait = await page.$$eval(itemSelector, els => els.length);
            console.log(`${logPrefix} Item count after wait: ${currentItemCountAfterWait} (Before this click: ${currentItemCountBeforeClick})`);
            if (currentItemCountAfterWait === currentItemCountBeforeClick) {
                console.log(`${logPrefix} Item count (${currentItemCountAfterWait}) did not increase after click ${clicksMade}. Assuming no more items or button ineffective. Stopping.`);
                break;
            }

        } catch (error: any) {
            console.warn(`${logPrefix} Error during interaction cycle (click attempt ${clickAttempt + 1}): ${error.message}. Stopping.`);
            if (button) await button.dispose();
            break;
        }
        console.log(`${logPrefix} --- Finished Click Attempt ${clickAttempt + 1} ---`);
    }

    console.log(`${logPrefix} Finished "Load More Button" interaction. Total clicks made: ${clicksMade}.`);
    return clicksMade;
}