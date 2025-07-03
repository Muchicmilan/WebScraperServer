export function checkStructuredDataForKeywords(data: Record<string, any> | null | undefined, keywordsToCheck: string[]): boolean {
    if (!keywordsToCheck || keywordsToCheck.length === 0) {
        return true;
    }
    if (!data || typeof data !== 'object') {
        return false;
    }

    const lowerCaseKeywords = keywordsToCheck.map(k => k.toLowerCase().trim()).filter(Boolean);
    if (lowerCaseKeywords.length === 0) return true;

    let found = false;

    function traverse(currentData: any) {
        if (found) return;

        if (typeof currentData === 'string') {
            const lowerCaseData = currentData.toLowerCase();
            for (const keyword of lowerCaseKeywords) {
                if (lowerCaseData.includes(keyword)) {
                    found = true;
                    return;
                }
            }
        } else if (Array.isArray(currentData)) {
            for (const item of currentData) {
                if (found) return;
                traverse(item);
            }
        } else if (typeof currentData === 'object' && currentData !== null) {
            for (const key in currentData) {
                if (found) return;
                if (Object.prototype.hasOwnProperty.call(currentData, key)) {
                    traverse(currentData[key]);
                }
            }
        }
    }
    traverse(data);
    return found;
}