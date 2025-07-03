import mongoose, {Document, Schema} from "mongoose";
import {DEFAULT_POOL_OPTIONS} from "../constants/browserPool.constants.js";

export interface IEngineSettings extends Document {
    singleton: boolean;
    maxPoolSize: number;
    minPoolSize: number;
    idleTimeoutMs: number;
    retryLimit: number;
}

export const EngineSettingsSchema = new Schema<IEngineSettings>({
    singleton : {type: Boolean, default: true, unique: true, required: true},
    maxPoolSize : {type: Number, required: true, default: DEFAULT_POOL_OPTIONS.maxPoolSize, min: 1},
    minPoolSize : {type: Number, required: true, default: DEFAULT_POOL_OPTIONS.minPoolSize, min: 0},
    idleTimeoutMs: {type: Number, required: true, default: DEFAULT_POOL_OPTIONS.idleTimeoutMs, min: 10000},
    retryLimit : {type: Number, required: true, default: DEFAULT_POOL_OPTIONS.retryLimit, min: 0},
}, {timestamps : true});

EngineSettingsSchema.pre<IEngineSettings>('validate', function (next){
    if (this.minPoolSize > this.maxPoolSize){
        next(new Error ('minPoolSize cannot be greater than maxPoolSize'));
    }
    else {
        next();
    }
});

export const EngineSettingsModel = mongoose.model<IEngineSettings>(
    'EngineSettings',
    EngineSettingsSchema
);