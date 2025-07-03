import { IScraperConfiguration, IFieldMapping } from "../models/scraperConfig.model.js";
import { ExtractedData } from "../scraper-engine-types.js";
import { Page } from "puppeteer";
import { extractDataFromElement } from "./browserSideLogic.js";


export async function extractDetailData(
    page: Page,
    config: IScraperConfiguration
): Promise<ExtractedData> {
    const logPrefix = `[Utils:extractDetailData | ${page.url()}]`;
    console.log(`${logPrefix} Extracting data...`);

    const itemSelectorToUse = config.detailItemSelector || config.itemSelector;
    const mappingsToUse = (config.detailFieldMappings && config.detailFieldMappings.length > 0)
        ? config.detailFieldMappings
        : config.fieldMappings;
    const pageUrl = page.url();

    const exclusions = config.scrapeOptions?.excludeSelectors;
    if (exclusions && exclusions.length > 0) {
        try {
            await page.evaluate((selectorsToRemove) => {
                selectorsToRemove.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
            }, exclusions);
            console.log(`${logPrefix} Applied ${exclusions.length} exclusion selectors.`);
        } catch (error: any) {
            console.warn(`${logPrefix} Error applying exclusions: ${error.message}`);
        }
    }

    try {
        const extractedData = await page.evaluate(
            (selector: string, mappings: IFieldMapping[], currentUrl: string, extractorFnString: string) => {
                const extractor = new Function(`return ${extractorFnString}`)();

                const mainElement = document.querySelector(selector);
                if (!mainElement) {
                    console.warn(`[Browser Context] Detail item selector "${selector}" not found.`);
                    return {};
                }
                return extractor(mainElement, mappings, currentUrl);
            },
            itemSelectorToUse,
            mappingsToUse,
            pageUrl,
            extractDataFromElement.toString()
        );

        console.log(`${logPrefix} Extracted ${Object.keys(extractedData).length} fields.`);
        return extractedData || {};

    } catch (error: any) {
        console.error(`${logPrefix} Error during page.evaluate for data extraction: ${error.message}`);
        throw new Error(`Data extraction failed via Puppeteer evaluate: ${error.message}`);
    }
}