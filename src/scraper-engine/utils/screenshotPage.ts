import {Page} from "puppeteer";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import {IScraperConfiguration} from "../models/scraperConfig.model.js";

export async function takeScreenshot(
    page: Page,
    config: IScraperConfiguration,
    context: 'list' | 'detail' | string = 'detail'
): Promise<void> {
    if (!config.enableScreenshots) {
        return;
    }

    const options = config.screenshotOptions || {};
    const url = page.url();
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');

    let safeUrlPart = 'url-error';
    try {
        safeUrlPart = crypto.createHash('sha1').update(url).digest('hex').substring(0, 16);
    } catch (e) {
        console.warn(`[Service:takeScreenshot] Could not generate hash for URL: ${url}`);
        safeUrlPart = crypto.createHash('sha1').update(Date.now().toString()).digest('hex').substring(0, 16);
    }

    const safeConfigName = config.name
        .replace(/[<>:"/\\|?* ]+/g, '_')
        .substring(0, 50);
    const screenshotDir = path.resolve(process.cwd(), 'screenshots', safeConfigName);

    const filename = `${dateStr}_${timeStr}_${context}_${safeUrlPart}.png`;
    let fullPath = path.join(screenshotDir, filename);

    try {
        await fs.mkdir(screenshotDir, { recursive: true });
        console.log(`[Service:takeScreenshot] Taking screenshot for ${url}. Save path: ${fullPath}`);
        await page.screenshot({
            path: fullPath,
            fullPage: options.fullPage ?? true,
            type: options.type ==='jpeg' ? 'jpeg' : options.type === "webp" ? 'webp' : 'png'
        });
        console.log(`[Service:takeScreenshot] Screenshot saved successfully: ${fullPath}`);
    } catch (error: any) {
        console.error(`[Service:takeScreenshot] Failed to take or save screenshot for ${url} at path ${fullPath}: ${error.message}`);
        console.error(error.stack);
    }
}