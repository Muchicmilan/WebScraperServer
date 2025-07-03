import { Request, Response } from "express";
import { AccountModel } from "../models/account.model.js";

export const handleCreateAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const { platform, username, password } = req.body;
        if (!platform || !username || !password) {
            res.status(400).json({ error: "Platform, username, and password are required." });
            return;
        }

        const newAccount = new AccountModel({ platform, username, password });
        await newAccount.save();

        const responseData = newAccount.toObject();
        delete responseData.password;

        res.status(201).json({ success: true, data: responseData });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to create account." });
    }
};

export const handleGetAccounts = async (req: Request, res: Response): Promise<void> => {
    try {
        const accounts = await AccountModel.find().select('-password').lean();
        res.status(200).json({ success: true, data: accounts });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch accounts." });
    }
};