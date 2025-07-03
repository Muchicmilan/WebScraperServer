import puppeteer, {Browser, Page} from "puppeteer";
import {DEFAULT_USER_AGENT, PUPPETEER_TIMEOUT} from "../constants/puppeteer.constants.js";

export interface BrowserPoolOptions {
    maxPoolSize: number;
    minPoolSize: number;
    browserLaunchArgs?: string[];
    idleTimeoutMs?: number;
    retryLimit?: number;
}

export interface PooledBrowser {
    browser: Browser;
    id: string;
    isIdle: boolean;
    lastUsed: Date;
    pagesCreated: number;
}

const DEFAULT_POOL_OPTIONS: BrowserPoolOptions = {
    maxPoolSize: 5,
    minPoolSize: 2,
    idleTimeoutMs: 60000,
    retryLimit: 3
};

export class BrowserPool {
    private pool: PooledBrowser[] = [];
    private options: BrowserPoolOptions;
    private maintenanceInterval: NodeJS.Timeout | null = null;
    private isShuttingDown = false;

    constructor(options: Partial<BrowserPoolOptions> = {}) {
        this.options = { ...DEFAULT_POOL_OPTIONS, ...options };

        this.maintenanceInterval = setInterval(
            () => this.performMaintenance(),
            Math.max(30000, this.options.idleTimeoutMs! / 2)
        );
    }

    public async initialize(): Promise<void> {
        console.log(`[BrowserPool:initialize] Initializing browser pool with min size ${this.options.minPoolSize}`);

        try {
            const initPromises = [];
            for (let i = 0; i < this.options.minPoolSize; i++) {
                initPromises.push(this.createPooledBrowser());
            }
            await Promise.all(initPromises);
            console.log(`[BrowserPool:initialize] Pool initialized with ${this.pool.length} browsers`);
        } catch (error: any) {
            console.error(`[BrowserPool:initialize] Failed to initialize pool: ${error.message}`);
            throw error;
        }
    }

    public async getBrowser(): Promise<PooledBrowser> {
        if (this.isShuttingDown) {
            throw new Error("Browser pool is shutting down, cannot get new browser");
        }

        const idleBrowser = this.pool.find(b => b.isIdle);
        if (idleBrowser) {
            console.log(`[BrowserPool:getBrowser] Reusing idle browser ${idleBrowser.id}`);
            idleBrowser.isIdle = false;
            idleBrowser.lastUsed = new Date();
            return idleBrowser;
        }

        if (this.pool.length < this.options.maxPoolSize) {
            console.log(`[BrowserPool:getBrowser] Creating new browser, pool size: ${this.pool.length}/${this.options.maxPoolSize}`);
            return await this.createPooledBrowser();
        }
        console.log(`[BrowserPool:getBrowser] Pool at capacity (${this.pool.length}), waiting for available browser`);
        return new Promise((resolve, reject) => {
            let retryCount = 0;
            const maxRetries = this.options.retryLimit || 3;

            const checkForIdleBrowser = () => {
                if (this.isShuttingDown) {
                    return reject(new Error("Browser pool is shutting down"));
                }

                const idleBrowser = this.pool.find(b => b.isIdle);
                if (idleBrowser) {
                    idleBrowser.isIdle = false;
                    idleBrowser.lastUsed = new Date();
                    console.log(`[BrowserPool:getBrowser] Found idle browser ${idleBrowser.id} after waiting`);
                    resolve(idleBrowser);
                } else {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        reject(new Error(`Failed to get browser after ${maxRetries} retries`));
                    } else {
                        console.log(`[BrowserPool:getBrowser] No idle browser found, retrying in 2s (${retryCount}/${maxRetries})`);
                        setTimeout(checkForIdleBrowser, 2000);
                    }
                }
            };

            setTimeout(checkForIdleBrowser, 1000);
        });
    }

    public async getPage(url?: string): Promise<{ page: Page, browserId: string }> {
        const pooledBrowser = await this.getBrowser();

        try {
            const page = await pooledBrowser.browser.newPage();
            await page.setUserAgent(DEFAULT_USER_AGENT);
            await page.setViewport({ width: 1366, height: 768 });

            pooledBrowser.pagesCreated++;

            if (url) {
                console.log(`[BrowserPool:getPage] Navigating to ${url}`);
                await page.goto(url, {
                    waitUntil: 'load',
                    timeout: PUPPETEER_TIMEOUT
                });
            }

            return {
                page,
                browserId: pooledBrowser.id
            };
        } catch (error) {
            this.releaseBrowser(pooledBrowser.id);
            throw error;
        }
    }

    public releaseBrowser(browserId: string): void {
        const browser = this.pool.find(b => b.id === browserId);
        if (browser) {
            browser.isIdle = true;
            browser.lastUsed = new Date();
            console.log(`[BrowserPool:releaseBrowser] Released browser ${browserId} back to pool`);
        }
    }

    public async releasePage(page: Page): Promise<void> {
        try {
            const browser = page.browser();
            const pooledBrowser = this.pool.find(b => b.browser === browser);

            await page.close();

            if (pooledBrowser) {
                this.releaseBrowser(pooledBrowser.id);
            }
        } catch (error: any) {
            console.error(`[BrowserPool:releasePage] Error releasing page: ${error.message}`);
        }
    }

    private async performMaintenance(): Promise<void> {
        if (this.isShuttingDown) return;

        const now = new Date();
        const idleTimeoutMs = this.options.idleTimeoutMs || 60000;
        const idleBrowsers = this.pool.filter(browser =>
            browser.isIdle &&
            (now.getTime() - browser.lastUsed.getTime() > idleTimeoutMs)
        );

        const excessIdleBrowsers = idleBrowsers.slice(0, Math.max(0, this.pool.length - this.options.minPoolSize));

        if (excessIdleBrowsers.length > 0) {
            console.log(`[BrowserPool:maintenance] Closing ${excessIdleBrowsers.length} idle browsers`);

            for (const browser of excessIdleBrowsers) {
                try {
                    await browser.browser.close();
                    this.pool = this.pool.filter(b => b.id !== browser.id);
                    console.log(`[BrowserPool:maintenance] Closed idle browser ${browser.id}`);
                } catch (error: any) {
                    console.error(`[BrowserPool:maintenance] Error closing browser ${browser.id}: ${error.message}`);
                }
            }
        }
    }

    private async createPooledBrowser(): Promise<PooledBrowser> {
        const id = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[BrowserPool:createBrowser] Launching browser ${id}`);

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
                    '--disable-gpu',
                    ...(this.options.browserLaunchArgs || [])
                ]
            });

            const pooledBrowser: PooledBrowser = {
                browser,
                id,
                isIdle: false,
                lastUsed: new Date(),
                pagesCreated: 0
            };

            this.pool.push(pooledBrowser);
            console.log(`[BrowserPool:createBrowser] Browser ${id} created and added to pool`);

            return pooledBrowser;
        } catch (error: any) {
            console.error(`[BrowserPool:createBrowser] Failed to launch browser ${id}: ${error.message}`);
            throw error;
        }
    }

    public async shutdown(): Promise<void> {
        this.isShuttingDown = true;

        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
            this.maintenanceInterval = null;
        }

        console.log(`[BrowserPool:shutdown] Shutting down browser pool with ${this.pool.length} browsers`);

        const closePromises = this.pool.map(async (browser) => {
            try {
                await browser.browser.close();
                console.log(`[BrowserPool:shutdown] Browser ${browser.id} closed`);
            } catch (error: any) {
                console.error(`[BrowserPool:shutdown] Error closing browser ${browser.id}: ${error.message}`);
            }
        });

        await Promise.all(closePromises);
        this.pool = [];
        console.log(`[BrowserPool:shutdown] Browser pool shutdown complete`);
    }

    public getStats() {
        return {
            totalBrowsers: this.pool.length,
            idleBrowsers: this.pool.filter(b => b.isIdle).length,
            activeBrowsers: this.pool.filter(b => !b.isIdle).length,
            totalPagesCreated: this.pool.reduce((sum, b) => sum + b.pagesCreated, 0)
        };
    }
}