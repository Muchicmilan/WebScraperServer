import {Page} from "puppeteer";
import {IPageLoadWait} from "../models/interactionOptions.model.js";

export async function applyPageWait(page: Page, waitOptions?: IPageLoadWait): Promise<void> {
    if (!waitOptions) return;

    const strategy = waitOptions.waitStrategy;
    const selector = waitOptions.waitForSelector;
    const timeout = waitOptions.waitForTimeout;
    const selectorTimeout = waitOptions.waitForTimeoutOnSelector || 1000;
    const logPrefix = `[Utils:applyPageLoadWait | ${page.url()}]`;

    try {
        if(strategy === 'selector' && selector) {
            console.log(`${logPrefix} Waiting for selector "${selector}" (max ${selectorTimeout}ms)...`);
            await page.waitForSelector(selector, { visible: true, timeout: selectorTimeout });
            console.log(`${logPrefix} Selector "${selector}" found.`);
        }
        else if (strategy === 'timeout' && timeout && timeout > 0) {
            console.log(`${logPrefix} Waiting for ${timeout}ms...`);
            await new Promise(resolve => setTimeout(resolve, timeout));
            console.log(`${logPrefix} Finished waiting ${timeout}ms.`);
        }
        else if (strategy !== 'none'){
            console.warn(`${logPrefix} Invalid wait configuration (Strategy: ${strategy}, Selector: ${selector}, Timeout: ${timeout}). Skipping wait.`);
        }
    }catch (waitError: any) {
        if (strategy === 'selector') {
            console.warn(`${logPrefix} Failed to find selector "${selector}" within ${selectorTimeout}ms: ${waitError.message}. Proceeding anyway.`);
        } else {
            console.error(`${logPrefix} Error during wait (${strategy}): ${waitError.message}. Proceeding anyway.`);
        }
    }
}

export async function closePopups(page: Page, selectors?: string[]): Promise<void> {
    if (!selectors || selectors.length === 0) {
        return;
    }
    const logPrefix = `[Utils:closePopups | ${page.url()}]`;
    console.log(`${logPrefix} Attempting to close popups matching: ${selectors.join(', ')}`);

    for (const selector of selectors) {
        try {
            const closedCount = await page.$$eval(selector, (elements, sel) => {
                let count = 0;
                elements.forEach(el => {
                    if (el && typeof (el as HTMLElement).click === 'function') {
                        try {
                            (el as HTMLElement).click();
                            console.log(`[Browser Context] Clicked popup element matching selector: ${sel}`);
                            count++;
                        } catch (clickError) {
                            console.warn(`[Browser Context] Failed to click popup ${sel}, attempting removal: ${(clickError as Error).message}`);
                            el.remove();
                            count++;
                        }
                    } else if (el) {
                        el.remove();
                        console.log(`[Browser Context] Removed popup element matching selector: ${sel}`);
                        count++;
                    }
                });
                return count;
            }, selector);

            if (closedCount > 0) {
                console.log(`${logPrefix} Actioned ${closedCount} element(s) for popup selector: ${selector}`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Short delay after action
            }
            else {
                console.log(`${logPrefix} No elements found for popup selector: ${selector}`);
            }
        } catch (error: any) {
            if (!error.message.includes('failed to find element matching selector') && !error.message.includes('is not a valid selector')) {
                console.warn(`${logPrefix} Error processing popup selector "${selector}": ${error.message}`);
            } else {
                console.log(`${logPrefix} Selector "${selector}" not found on page.`);
            }
        }
    }

    console.log(`${logPrefix} Finished popup closure attempts.`);
}
