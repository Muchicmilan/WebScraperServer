import mongoose, {Document, Schema} from "mongoose";

export interface IScrapedDataItem extends Document {
    configId: mongoose.Types.ObjectId;
    url: string;
    scrapedAt: Date;
    data: mongoose.Schema.Types.Mixed;
    createdAt: Date;
    updatedAt: Date;
}

const ScrapedDataItemSchema = new Schema<IScrapedDataItem>({
    configId: { type: Schema.Types.ObjectId, ref: 'ScraperConfiguration', required: true, index: true },
    url: { type: String, required: true, index: true },
    scrapedAt: { type: Date, default: Date.now },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

ScrapedDataItemSchema.index({ configId: 1, url: 1 }, { unique: true });

export const ScrapedDataItemModel = mongoose.model<IScrapedDataItem>(
    'ScrapedDataItem',
    ScrapedDataItemSchema
)
