import {Schema} from "mongoose";

export interface IInteractionOptions {
    interactionStrategy?: 'none' | 'infiniteScroll' | 'loadMoreButton' | 'fixedScrolls';
    maxScrolls?: number;
    scrollDelayMs?: number;
    scrollStagnationTimeoutMs?: number;
    loadMoreButtonSelector?: string;
    maxClicks?: number;
    clickDelayMs?: number;
    maxItemsToScrape?: number;
    buttonScrollAttempts?: number;
    buttonScrollDelayMs?: number;
    scrollAmount?: number;
    maxEmptyScrolls?: number;
    contentLoadWaitMs?: number;
}

export interface IPageLoadWait {
    waitStrategy ?: 'none' | 'timeout' | 'selector';
    waitForTimeout?: number;
    waitForSelector?: string;
    waitForTimeoutOnSelector?: number;
}

export const PageLoadWaitOptionsSchema = new Schema<IPageLoadWait>({
    waitStrategy : {type: String,enum: ['none','timeout','selector'], default:'none', required: false},
    waitForTimeout: {type: Number, required: false, min: 1},
    waitForSelector: {type: String, required: false},
    waitForTimeoutOnSelector:{type: Number, required: false, min: 100, default: 1000},
}, {_id: false });


export const InteractionOptionsSchema = new Schema<IInteractionOptions>({
    interactionStrategy: { type: String, enum: ['none', 'infiniteScroll', 'loadMoreButton', 'fixedScrolls'], default: 'none', required: false },
    maxScrolls: { type: Number, min: 1, default: 20, required: false },
    scrollDelayMs: { type: Number, min: 200, default: 500, required: false },
    scrollStagnationTimeoutMs: { type: Number, min: 1000, default: 3000, required: false },
    loadMoreButtonSelector : {type: String,required: false},
    maxClicks : {type: Number, required: false, min: 0, default: 0},
    clickDelayMs : {type: Number, required: false, min: 500, default: 1000},
    maxItemsToScrape : {type: Number, required: false, min: 50},
    buttonScrollAttempts: { type: Number, min: 1, default: 3, required: false },
    buttonScrollDelayMs: { type: Number, min: 100, default: 400, required: false },
},{_id: false})

