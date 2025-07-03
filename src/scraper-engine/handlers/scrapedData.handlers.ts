import {Request, Response} from "express";
import mongoose, {SortOrder} from "mongoose";
import {ScrapedDataItemModel} from "../models/scrapedDataItem.model.js";

export const handleGetScrapedData = async (req: Request, res: Response): Promise<void> => {
    const { configId, limit = '20', page = '1', sort = 'scrapedAt', order = '-1' } = req.query; // Add sort/order

    if (!configId || typeof configId !== 'string' || !mongoose.Types.ObjectId.isValid(configId)) {
        res.status(400).json({ error: "Valid 'configId' query parameter is required." });
        return;
    }

    const limitNum = parseInt(limit as string, 10);
    const pageNum = parseInt(page as string, 10);
    //const sortOrder = parseInt(order as string, 10) === 1 ? 1 : -1;
    const sortField = typeof sort === 'string' ? sort : 'scrapedAt';

    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100 || isNaN(pageNum) || pageNum <= 0) {
        res.status(400).json({ error: "Invalid 'limit' (1-100) or 'page' (> 0) parameter." });
        return;
    }

    const skip = (pageNum - 1) * limitNum;
    const sortDirection: SortOrder = parseInt(order as string, 10) === 1 ? 1 : -1
    const sortOption = { [sortField]: sortDirection };

    try {
        const [items, totalCount] = await Promise.all([
            ScrapedDataItemModel.find({ configId: configId })
                .sort(sortOption)
                .limit(limitNum)
                .skip(skip)
                .lean(),
            ScrapedDataItemModel.countDocuments({ configId: configId })
        ]);

        res.status(200).json({
            success: true,
            data: items,
            pagination: {
                totalItems: totalCount,
                itemCount: items.length,
                itemsPerPage: limitNum,
                currentPage: pageNum,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });
    } catch (error) {
        console.error(`[Handler] Error fetching scraped data for config ${configId}:`, error);
        res.status(500).json({ error: "Failed to fetch scraped data." });
    }
};

export const handleGetScrapedItemById = async (req: Request, res: Response): Promise<void> => {
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
        res.status(400).json({ error: "Invalid Scraped Item ID format." });
        return;
    }

    try {
        const item = await ScrapedDataItemModel.findById(itemId).lean();

        if (!item) {
            res.status(404).json({ error: "Scraped data item not found." });
            return;
        }

        res.status(200).json({ success: true, data: item });

    } catch (error) {
        console.error(`[Handler] Error fetching scraped item by ID ${itemId}:`, error);
        res.status(500).json({ error: "Failed to fetch scraped data item." });
    }
};