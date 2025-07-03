import {Request, Response} from "express";
import {BrowserPoolOptions} from "../scraper-engine-types.js";
import {getCurrentPoolOptions} from "../browserPooling/browserPoolInstancing.js";
import {EngineSettingsModel, IEngineSettings} from "../models/engineSettings.model.js";
import {DEFAULT_POOL_OPTIONS} from "../constants/browserPool.constants.js";

export const handleGetEngineSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        let settings: BrowserPoolOptions | IEngineSettings | null = null;
        settings = await EngineSettingsModel.findOne({ singleton: true }).lean();

        if (!settings) {
            settings = getCurrentPoolOptions();
            if (!settings) {
                console.warn("[Handler:GetSettings] No settings in DB and pool not active, returning defaults.");
                settings = DEFAULT_POOL_OPTIONS;
            } else {
                console.log("[Handler:GetSettings] No settings in DB, returning active pool options.");
            }
        } else {
            console.log("[Handler:GetSettings] Returning settings from DB.");
        }


        res.status(200).json({ success: true, data: settings });
    } catch (error: any) {
        console.error("[Handler] Error fetching engine settings:", error);
        res.status(500).json({ error: "Failed to fetch engine settings." });
    }
};

export const handleUpdateEngineSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const { maxPoolSize, minPoolSize, idleTimeoutMs, retryLimit } = req.body;
        if (typeof maxPoolSize !== 'number' || typeof minPoolSize !== 'number' || typeof idleTimeoutMs !== 'number' || typeof retryLimit !== 'number') {
            res.status(400).json({ error: "Invalid data types for pool settings. All must be numbers." });
            return;
        }
        if (minPoolSize > maxPoolSize) {
            res.status(400).json({ error: "minPoolSize cannot be greater than maxPoolSize." });
            return;
        }
        if (maxPoolSize < 1 || minPoolSize < 0 || idleTimeoutMs < 1000 || retryLimit < 0) {
            res.status(400).json({ error: "One or more settings values are out of reasonable bounds."});
            return;
        }


        const updatedSettings = await EngineSettingsModel.findOneAndUpdate(
            { singleton: true },
            { $set: { maxPoolSize, minPoolSize, idleTimeoutMs, retryLimit } },
            { new: true, upsert: true, runValidators: true }
        ).lean();

        console.log("[Handler:UpdateSettings] Engine settings updated in DB. Pool restart required for changes to take effect.", updatedSettings);


        res.status(200).json({
            success: true,
            data: updatedSettings,
            message: "Settings updated successfully. Restart the application or browser pool for changes to take effect."
        });
    } catch (error: any) {
        console.error("[Handler] Error updating engine settings:", error);
        if (error.name === 'ValidationError') {
            res.status(400).json({ error: `Validation Error: ${error.message}` });
        } else {
            res.status(500).json({ error: "Failed to update engine settings." });
        }
    }
};