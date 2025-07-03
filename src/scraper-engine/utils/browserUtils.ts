import puppeteer, {Browser, Page} from "puppeteer";
import {DEFAULT_USER_AGENT, PUPPETEER_TIMEOUT} from "../constants/puppeteer.constants.js";
import {IFieldMapping} from "../models/scraperConfig.model.js";

export async function launchBrowser(): Promise<Browser> {
    console.log("[Utils:launchBrowser] Launching browser...");
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        console.log("[Utils:launchBrowser] Browser launched successfully.");
        return browser;
    } catch (error: any) {
        console.error(`[Utils:launchBrowser] Failed to launch browser: ${error.message}`);
        throw error;
    }
}

export async function navigatePage(browser: Browser, url: string): Promise<Page> {
    console.log(`[Utils:navigatePage] Creating new page and navigating to: ${url}`);
    let page: Page | null = null;
    try {
        page = await browser.newPage();
        await page.setUserAgent(DEFAULT_USER_AGENT);
        await page.setViewport({ width: 1366, height: 768 });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: PUPPETEER_TIMEOUT });
        console.log(`[Utils:navigatePage] Navigation successful for: ${url}`);
        return page;
    } catch (error: any) {
        console.error(`[Utils:navigatePage] Navigation failed for ${url}: ${error.message}`);
        if (page) {
            try { await page.close(); } catch (closeError) { /* ignore */ }
        }
        throw new Error(`Navigation failed for ${url}: ${error.message}`);
    }
}

