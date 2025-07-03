import { IFieldMapping } from "../models/scraperConfig.model.js";
import { ExtractedData } from "../scraper-engine-types.js";


export function extractDataFromElement(
    targetElement: Element | null,
    mappings: IFieldMapping[],
    pageUrl: string
): ExtractedData {
    function set(obj: any, path: string | string[], value: any): void {
        const keys = Array.isArray(path) ? path : path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || current[key] === null) {
                current[key] = {};
            }
            current = current[key];
        }
        if (keys.length > 0) {
            current[keys[keys.length - 1]] = value;
        }
    }

    if (!targetElement) return {};

    const resultData: ExtractedData = {};

    for (const mapping of mappings) {
        if (!mapping || !mapping.fieldName || !mapping.selector || !mapping.extractFrom) continue;

        let value: string | null | undefined = undefined;
        try {
            const elementsToQuery = (mapping.selector === ':scope' || mapping.selector === '*')
                ? [targetElement]
                : Array.from(targetElement.querySelectorAll(mapping.selector));

            if (elementsToQuery.length > 0) {
                if (mapping.extractFrom === 'text') {
                    const textParts: string[] = [];
                    elementsToQuery.forEach(elem => {
                        const text = (elem as HTMLElement).innerText?.trim();
                        if (text) textParts.push(text);
                    });
                    if (textParts.length > 0) value = textParts.join(' ').replace(/\s+/g, ' ').trim();
                } else {
                    const firstTarget = elementsToQuery[0];
                    if (mapping.extractFrom === 'attribute' && mapping.attributeName) {
                        value = firstTarget.getAttribute(mapping.attributeName)?.trim();
                        if (value && (mapping.attributeName === 'href' || mapping.attributeName === 'src')) {
                            try { value = new URL(value, pageUrl).href; } catch (e) { /* ignore invalid URLs */ }
                        }
                    } else if (mapping.extractFrom === 'html') {
                        value = firstTarget.innerHTML?.trim();
                    }
                }
            }
        } catch (e: any) {
            console.error(`[Browser Context] Error processing selector "${mapping.selector}" for field "${mapping.fieldName}": ${e.message}`);
        }

        if (value !== undefined && value !== null && value !== '') {
            set(resultData, mapping.fieldName, value);
        }
    }
    return resultData;
}