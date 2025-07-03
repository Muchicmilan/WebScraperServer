import {Page} from "puppeteer";
import {IInteractionOptions} from "../models/interactionOptions.model.js";

export async function scrollToBottomUntilStable(
    page: Page,
    safetyMaxScrolls: number = 20,
    scrollDelayMs: number = 500,
    stagnationTimeoutMs: number = 3000
): Promise<number> {
    const logPrefix = `[Utils:scrollToBottomUntilStable | ${page.url()}]`;
    let scrollsMade = 0;
    let lastHeight = 0;
    let currentHeight = 0;
    let stableCount = 0;
    const requiredStableCount = Math.ceil(stagnationTimeoutMs / scrollDelayMs);

    console.log(`${logPrefix} Starting infinite scroll process. Safety Max scrolls: ${safetyMaxScrolls}, Delay: ${scrollDelayMs}ms, Stagnation Timeout: ${stagnationTimeoutMs}ms`);
    while (scrollsMade < safetyMaxScrolls){
        lastHeight = await page.evaluate(() => document.body.scrollHeight)
        await page.evaluate(()=> window.scrollTo(0, document.body.scrollHeight));
        scrollsMade++;

        await new Promise(resolve => setTimeout(resolve, scrollDelayMs));
        currentHeight = await page.evaluate(() => document.body.scrollHeight)

        if(currentHeight === lastHeight){
            stableCount++;
            if(stableCount >= requiredStableCount){
                console.log(`${logPrefix} Page height stabilized after ${scrollsMade} scrolls. Stopping.`);
                break;
            }
        }
        else {
            stableCount = 0;
        }
        if (scrollsMade >= safetyMaxScrolls){
            console.log(`${logPrefix} Reached safety scroll limit (${safetyMaxScrolls}). Stopping scroll.`);
        }
    }
    console.log(`${logPrefix} Finished infinite scroll process. Total scrolls made: ${scrollsMade}. Final height: ${currentHeight}`);
    return scrollsMade;
}

export async function handleFixedScrollsInteraction(
    page: Page,
    options: Required<Pick<IInteractionOptions, 'maxScrolls' | 'scrollDelayMs'>>
): Promise<number> {
    const {maxScrolls, scrollDelayMs} = options;
    const logPrefix = `[Utils:handleFixedScrolls | ${page.url()}]`;
    let scrollsMade = 0;
    console.log(`${logPrefix} Starting fixed scroll process. Scrolls: ${maxScrolls}, Delay: ${scrollDelayMs}ms`);

    for(let i=0; i<maxScrolls; i++){
        try {
            await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
            scrollsMade++;
            await new Promise(resolve => setTimeout(resolve, scrollDelayMs));
        }catch(error : any){
            console.warn(`${logPrefix} Error during scroll ${scrollsMade + 1}: ${error.message}. Stopping.`);
            break;
        }
    }
    console.log(`${logPrefix} Finished fixed scroll process. Total scrolls made: ${scrollsMade}.`);
    return scrollsMade;
}