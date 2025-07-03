import {BrowserPoolOptions} from "../scraper-engine-types.js";

export const DEFAULT_POOL_OPTIONS: BrowserPoolOptions = {
    maxPoolSize: 5,
    minPoolSize: 2,
    idleTimeoutMs: 60000,
    retryLimit: 3
}