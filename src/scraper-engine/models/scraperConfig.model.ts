import mongoose, {Document, Schema} from "mongoose";
import {
    IInteractionOptions,
    InteractionOptionsSchema,
    IPageLoadWait,
    PageLoadWaitOptionsSchema
} from "./interactionOptions.model.js";
import cron from "node-cron";
import {ILoginConfig, LoginConfigSchema} from "./login.model.js";

export interface IFieldMapping {
    fieldName: string;
    selector: string;
    extractFrom: 'text' | 'attribute' | 'html';
    attributeName?: string;
}


export interface IScraperConfiguration extends Document {
    name: string;
    startUrls: string[];
    pageType: 'ListPage' | 'DetailPage';
    itemSelector: string;
    scrapeDetailsFromList?: boolean;
    scrapeOptions?: {
        excludeSelectors?: string[];
    };
    targetSchema: mongoose.Schema.Types.Mixed;
    fieldMappings: IFieldMapping[];
    detailItemSelector: string;
    detailFieldMappings?: IFieldMapping[];
    detailTargetSchema: mongoose.Schema.Types.Mixed;
    keywordsToFilterBy?: string[];
    enableScreenshots?: boolean;
    screenshotOptions?: {
        fullPage?: boolean;
        type?: 'png' | 'jpeg' | 'webp';
        quality?: number
        pathTemplate?: string;
    }
    cronSchedule?: string;
    cronEnabled?: boolean;
    pageLoadWaitOptions?: IPageLoadWait;
    interactionOptions?: IInteractionOptions;
    closePopupSelectors?: string[];
    loginConfig?: ILoginConfig;
    createdAt: Date;
    updatedAt: Date;
}

const FieldMappingSchema = new Schema<IFieldMapping>({
    fieldName: { type: String, required: true },
    selector: { type: String, required: true },
    extractFrom: { type: String, enum: ['text', 'attribute', 'html'], required: true, default: 'text' },
    attributeName: { type: String, required: function() { return (this as IFieldMapping).extractFrom === 'attribute'; } }
}, { _id: false });


const ScraperConfigurationSchema = new Schema<IScraperConfiguration>({
    name: { type: String, required: true, unique: true, index: true },
    startUrls: { type: [String], required: true, validate: (v: string[]) => Array.isArray(v) && v.length > 0 },
    pageType: { type: String, enum: ['ListPage', 'DetailPage'], required: true },
    itemSelector: { type: String, required: true },
    scrapeDetailsFromList: {type: Boolean, required: false, default: false},
    scrapeOptions: {
        excludeSelectors: { type: [String] }
    },
    targetSchema: { type: mongoose.Schema.Types.Mixed, required: true },
    fieldMappings: { type: [FieldMappingSchema], required: true, validate: (v: IFieldMapping[]) => Array.isArray(v) && v.length > 0 },
    detailItemSelector: {type: String, required:false},
    detailTargetSchema: {type: mongoose.Schema.Types.Mixed, required:false},
    enableScreenshots: {type: Boolean, required: false, default: false},
    screenshotOptions: {
        _id: false,
        fullPage:{type:Boolean, default: true, required: false},
        type:{type: String, enum: ['png','jpeg','webp'], default:'png', required: false},
        quality:{type:Number, min: 1, max: 100, default:100, required: false},
        pathTemplate:{type:String, required:false}
    },
    closePopupSelectors: {type: [String], required: false},
    pageLoadWaitOptions: {type: PageLoadWaitOptionsSchema, required: false},
    interactionOptions: {type: InteractionOptionsSchema, required: false},
    detailFieldMappings: {type: [FieldMappingSchema], required:false},
    keywordsToFilterBy: { type: [String], required: false },
    loginConfig: {type: LoginConfigSchema, required: false,},
    cronSchedule: {type: String, required: false, validate: {
            validator: function(v: string | null | undefined){
                if (!v) return true;
                return cron.validate(v);
            },
            message: props => `${props.value} is not valid cron schedule format.`
        }
    },
    cronEnabled: {type: Boolean, required: false, index:true}
}, { timestamps: true });

export const ScraperConfigurationModel = mongoose.model<IScraperConfiguration>(
    'ScraperConfiguration',
    ScraperConfigurationSchema
);