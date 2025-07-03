import {BrowserPool} from "./browserPoolClass.js";
import {BrowserPoolOptions} from "../scraper-engine-types.js";
import {EngineSettingsModel} from "../models/engineSettings.model.js";
import {DEFAULT_POOL_OPTIONS} from "../constants/browserPool.constants.js";

let browserPool : BrowserPool | null = null;
let currentPoolOptions : BrowserPoolOptions | null = null;

export async function getEnginePoolOptions(): Promise<BrowserPoolOptions> {
    try {
        const settings = await EngineSettingsModel.findOne({ singleton: true }).lean();
        if (settings) {
            console.log('[Service:getEnginePoolOptions] Found engine settings in DB.');
            return {
                maxPoolSize: settings.maxPoolSize,
                minPoolSize: settings.minPoolSize,
                idleTimeoutMs: settings.idleTimeoutMs,
                retryLimit: settings.retryLimit,
            };
        } else {
            console.log('[Service:getEnginePoolOptions] No engine settings found in DB, using defaults.');
            return { ...DEFAULT_POOL_OPTIONS };
        }
    } catch (error: any) {
        console.error(`[Service:getEnginePoolOptions] Error fetching settings, using defaults: ${error.message}`);
        return { ...DEFAULT_POOL_OPTIONS };
    }
}

export async function shutdownBrowserPool(): Promise<void> {
    if (browserPool) {
        console.log('[Service:shutdownBrowserPool] Shutting down browser pool...');
        await browserPool.shutdown();
        browserPool = null;
        currentPoolOptions = null;
        console.log('[Service:shutdownBrowserPool] Browser pool shut down.');
    }
}

export async function initializeBrowserPool(): Promise<BrowserPool> {
    if (!browserPool) {
        console.log('[Service:initializeBrowserPool] Initializing browser pool for the first time...');
        currentPoolOptions = await getEnginePoolOptions();
        console.log('[Service:initializeBrowserPool] Using pool options:', currentPoolOptions);
        browserPool = new BrowserPool(currentPoolOptions);
        await browserPool.initialize();
        console.log('[Service:initializeBrowserPool] Browser pool initialized successfully.');
    } else {
        console.log('[Service:initializeBrowserPool] Browser pool already initialized.');
    }
    return browserPool;
}

export function getBrowserPoolStats() {
    return browserPool ? browserPool.getStats() : null;
}

export function getCurrentPoolOptions(): BrowserPoolOptions | null {
    return currentPoolOptions ? { ...currentPoolOptions } : null;
}