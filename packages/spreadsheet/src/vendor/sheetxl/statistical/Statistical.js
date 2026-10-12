// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaError } from '@sheetxl/primitives';
function onFnA(callbackfn, ...value) {
    for (const range of value) {
        const isLiteral = range.isLiteral();
        for (const v of range.values({ coerce: false, includeMistyped: true })) {
            const type = typeof v;
            if (type === "number") {
                callbackfn(v);
                continue;
            }
            if (type === "string") {
                callbackfn(v);
                continue;
            }
            if (type === "boolean") {
                if (isLiteral)
                    continue;
                callbackfn(v);
                continue;
            }
            if (v.isFormulaError)
                throw v;
        }
    }
}
export function AVEDEV(...number) {
    let sum = 0;
    const arr = [];
    for (const range of number) {
        for (const v of range.values()) {
            sum += v;
            arr.push(v);
        }
    }
    const n = arr.length;
    const avg = sum / n;
    sum = 0;
    for (let i = 0; i < n; i++) {
        sum += Math.abs(arr[i] - avg);
    }
    return sum / n;
}
export function AVERAGE(...number) {
    let sum = 0;
    let cnt = 0;
    for (const range of number) {
        for (const v of range.values()) {
            sum += v;
            cnt++;
        }
    }
    if (cnt === 0) {
        throw FormulaError.BuiltIn.Div0;
    }
    return sum / cnt;
}
export function AVERAGEA(...value) {
    let sum = 0;
    let cnt = 0;
    for (const range of value) {
        const isLiteral = range.isLiteral();
        for (const v of range.values({ coerce: false, includeMistyped: true })) {
            const type = typeof v;
            if (type === "number") {
                sum += v;
                cnt++;
                continue;
            }
            if (type === "string") {
                cnt++;
                continue;
            }
            if (type === "boolean") {
                if (isLiteral)
                    continue;
                sum += v ? 1 : 0;
                cnt++;
                continue;
            }
            if (v.isFormulaError)
                return v;
        }
    }
    return sum / cnt;
}
export function AVERAGEIF(range, criteria, averageRange) {
    return undefined;
}
export function AVERAGEIFS(averageRange, criteriaRange, ...criteria) {
    return undefined;
}
export function COUNT(...number) {
    let cnt = 0;
    for (const range of number) {
        for (const v of range.values()) {
            cnt++;
        }
    }
    return cnt;
}
export function COUNTA(...value) {
    let cnt = 0;
    for (const range of value) {
        const isLiteral = range.isLiteral();
        for (const v of range.values({ coerce: false, includeMistyped: true })) {
            const type = typeof v;
            if (type === "number") {
                cnt++;
                continue;
            }
            if (type === "string") {
                cnt++;
                continue;
            }
            if (type === "boolean") {
                if (isLiteral)
                    continue;
                cnt++;
                continue;
            }
            if (v.isFormulaError)
                return v;
        }
    }
    return cnt;
}
export function COUNTBLANK(range) {
    return range.size;
}
export function COUNTIF(range, criteria) {
    return undefined;
}
export function COUNTIFS(criteriaRange, criteria) {
    return undefined;
}
;
export function LARGE(array, k) {
    k = Math.floor(k);
    if (k < 1)
        return Number.NaN;
    const values = [];
    for (const v of array.values()) {
        values.push(v);
    }
    if (values.length === 0)
        return Number.NaN;
    if (k > values.length)
        return Number.NaN;
    values.sort((a, b) => b - a);
    return values[k - 1];
}
export function MAX(...number) {
    let max = Number.MIN_SAFE_INTEGER;
    for (const range of number) {
        for (const v of range.values()) {
            max = Math.max(max, v);
        }
    }
    if (max === Number.MIN_SAFE_INTEGER)
        return 0;
    return max;
}
export function MAXA(...value) {
    let min = 0;
    onFnA((v) => {
        min = Math.min(min, v);
    }, ...value);
    return min;
}
export function MAXIFS(maxRange, criteriaRange, ...criteria) {
    return undefined;
}
export function MEDIAN(...number) {
    const values = [];
    for (const range of number) {
        for (const v of range.values()) {
            values.push(v);
        }
    }
    if (values.length === 0)
        Number.NaN;
    values.sort((a, b) => a - b);
    const n = values.length;
    if (n % 2 === 0) {
        const mid = n / 2;
        return (values[mid - 1] + values[mid]) / 2;
    }
    else {
        return values[Math.floor(n / 2)];
    }
}
export function MIN(...number) {
    let min = Number.MAX_SAFE_INTEGER;
    for (const range of number) {
        for (const v of range.values()) {
            min = Math.min(min, v);
        }
    }
    if (min === Number.MAX_SAFE_INTEGER)
        return 0;
    return min;
}
export function MINA(...value) {
    let min = 0;
    onFnA((v) => {
        min = Math.min(min, v);
    }, ...value);
    return min;
}
export function MINIFS(maxRange, criteriaRange, ...criteria) {
    return undefined;
}
export function PERMUT(number, numberChoosen) {
    return undefined;
}
export function PERMUTATIONA(number, numberChoosen) {
    return undefined;
}
export function SMALL(array, k) {
    k = Math.floor(k);
    if (k < 1)
        return Number.NaN;
    const values = [];
    for (const v of array.values()) {
        values.push(v);
    }
    if (values.length === 0)
        return Number.NaN;
    if (k > values.length)
        return Number.NaN;
    values.sort((a, b) => a - b);
    return values[k - 1];
}
