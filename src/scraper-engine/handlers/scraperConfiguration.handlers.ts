import {Request, Response} from "express";
import {ScraperConfigurationModel} from "../models/scraperConfig.model.js";
import mongoose from "mongoose";
import {removeJobSchedule, updateJobSchedule} from "../cron/cronScheduling.js";

export const handleCreateConfiguration = async (req: Request, res: Response): Promise<void> => {
    try {
        const newConfig = new ScraperConfigurationModel(req.body);
        await newConfig.save();
        res.status(201).json({ success: true, data: newConfig });
    } catch (error: any) {
        console.error("[Handler] Error creating configuration:", error);
        if (error.code === 11000) { res.status(409).json({ error: "Configuration name already exists." }); }
        else if (error.name === 'ValidationError') { res.status(400).json({ error: `Validation Error: ${error.message}` }); }
        else { res.status(500).json({ error: "Failed to create configuration." }); }
    }
};

export const handleGetAllConfigurations = async (req: Request, res: Response): Promise<void> => {
    try {
        const configs = await ScraperConfigurationModel.find().sort({ name: 1 }).lean();
        res.status(200).json({ success: true, count: configs.length, data: configs });
    } catch (error) {
        console.error("[Handler] Error fetching configurations:", error);
        res.status(500).json({ error: "Failed to fetch configurations." });
    }
};

export const handleGetConfigurationById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ error: "Invalid ID format." });
            return;
        }
        const config = await ScraperConfigurationModel.findById(id).lean();
        if (!config) {
            res.status(404).json({ error: "Configuration not found." });
            return;
        }
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        console.error("[Handler] Error fetching configuration:", error);
        res.status(500).json({ error: "Failed to fetch configuration." });
    }
};

export const handleUpdateConfiguration = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ error: "Invalid ID format." });
            return;
        }

        const updateData = {...req.body};
        if(updateData.cronEnabled === undefined){
            updateData.cronEnabled = !!updateData.cronSchedule;
        }

        const updatedConfig = await ScraperConfigurationModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedConfig) {
            res.status(404).json({ error: "Configuration not found." });
            return;
        }
        updateJobSchedule(updatedConfig);
        res.status(200).json({ success: true, data: updatedConfig.toObject() });
    } catch (error: any) {
        console.error("[Handler] Error updating configuration:", error);
        if (error.name === 'ValidationError') { res.status(400).json({ error: `Validation Error: ${error.message}` }); }
        else if (error.code === 11000) { res.status(409).json({ error: "Configuration name conflict on update." }); }
        else { res.status(500).json({ error: "Failed to update configuration." }); }
    }
};

export const handleDeleteConfiguration = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ error: "Invalid ID format." });
            return;
        }

        const deletedConfig = await ScraperConfigurationModel.findByIdAndDelete(id);
        if (!deletedConfig) {
            res.status(404).json({ error: "Configuration not found." });
            return;
        }

        removeJobSchedule(id);

        res.status(200).json({ success: true, message: "Configuration deleted successfully." });
    } catch (error:any) {
        console.error("[Handler] Error deleting configuration:", error);
        res.status(500).json({ error: "Failed to delete configuration." });
    }
};