import { Browser } from "puppeteer";

export interface ScrapeOptions {
  excludeSelectors?: string[];
}

export type ExtractedData = Record<string, any>;

export interface ProcessingResult {
  url: string;
  data: ExtractedData;
}

export type SingleItemOutcome =
    | { type: 'combined'; result: ProcessingResult }
    | { type: 'queue'; url: string }          
    | { type: 'direct'; result: ProcessingResult }
    | { type: 'skip'; reason: string }; 

    export interface ListItemEvalResult {
      listData: ExtractedData;
      detailUrl: string | null;
      error?: string;
  }

  export function isProcessingResult(obj: any): obj is ProcessingResult {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      typeof obj.url === 'string' &&
      typeof obj.data === 'object'
    );
  }

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