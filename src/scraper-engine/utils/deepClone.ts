export function simpleDeepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any;
    }
    if (Array.isArray(obj)) {
        const clonedArr = [];
        for (let i = 0; i < obj.length; i++) {
            clonedArr[i] = simpleDeepClone(obj[i]);
        }
        return clonedArr as any;
    }
    const clonedObj = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clonedObj[key] = simpleDeepClone(obj[key]);
        }
    }
    return clonedObj;
}

