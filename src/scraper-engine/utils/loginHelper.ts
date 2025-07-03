import { Page } from "puppeteer";
import { IAccount } from "../models/account.model.js";
import {ILoginConfig} from "../models/login.model.js";

export async function handleLogin(
    page: Page,
    account: IAccount,
    loginConfig: ILoginConfig
): Promise<void> {
    const logPrefix = `[LoginHelper | ${account.platform}]`;
    console.log(`${logPrefix} Attempting login for user: ${account.username}`);

    try {
        const password = account.decryptPassword();

        await page.waitForSelector(loginConfig.usernameSelector!, { visible: true });
        await page.type(loginConfig.usernameSelector!, account.username, { delay: 50 });

        await page.waitForSelector(loginConfig.passwordSelector!, { visible: true });
        await page.type(loginConfig.passwordSelector!, password, { delay: 50 });

        await page.waitForSelector(loginConfig.submitButtonSelector!, { visible: true });
        await page.click(loginConfig.submitButtonSelector!);

        console.log(`${logPrefix} Login form submitted. Waiting for post-login element...`);
        await page.waitForSelector(loginConfig.postLoginSelector!, { timeout: 15000 });

        console.log(`${logPrefix} Login successful for user: ${account.username}`);

    } catch (error: any) {
        console.error(`${logPrefix} Login failed for user ${account.username}: ${error.message}`);
        try {
            await page.screenshot({ path: `error_login_${account.username}.png`, fullPage: true });
            console.log(`${logPrefix} Saved error screenshot to error_login_${account.username}.png`);
        } catch (e) {}
        throw new Error(`Login failed: ${error.message}`);
    }
}