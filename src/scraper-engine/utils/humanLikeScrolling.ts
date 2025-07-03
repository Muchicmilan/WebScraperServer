import {Page} from 'puppeteer';

export async function smoothScroll(
    page: Page,
    scrollAmount: number,
    scrollStepMin: number = 100,
    scrollStepMax: number = 300,
    stepDelayMinMs: number = 50,
    stepDelayMaxMs: number = 150
): Promise<void> {
    await page.evaluate(
        async (amount, stepMin, stepMax, delayMin, delayMax) => {
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            let scrolled = 0;
            while (scrolled < amount) {
                const step = Math.floor(Math.random() * (stepMax - stepMin + 1) + stepMin);
                const delay = Math.floor(Math.random() * (delayMax - delayMin + 1) + delayMin);

                window.scrollBy(0, step);
                scrolled += step;

                await sleep(delay);
            }
        },
        scrollAmount,
        scrollStepMin,
        scrollStepMax,
        stepDelayMinMs,
        stepDelayMaxMs
    );
}

export async function humanLikeScrollToBottom(
    page: Page,
    scrollAmount: number,
    scrollDelayMinMs: number = 400,
    scrollDelayMaxMs: number = 1200
): Promise<void> {

    await smoothScroll(page, scrollAmount);

    const finalDelay = Math.floor(Math.random() * (scrollDelayMaxMs - scrollDelayMinMs + 1) + scrollDelayMinMs);
    await new Promise(resolve => setTimeout(resolve, finalDelay));
}