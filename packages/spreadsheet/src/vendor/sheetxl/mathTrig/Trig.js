// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
const MAX_NUMBER = 2 ** 27 - 1;
export function ACOS(number) {
    if (number > 1 || number < -1)
        return Number.NaN;
    return Math.acos(number);
}
export function ACOSH(number) {
    if (number < 1)
        return Number.NaN;
    return Math.acosh(number);
}
export function ACOT(number) {
    return Math.PI / 2 - Math.atan(number);
}
export function ACOTH(number) {
    if (Math.abs(number) <= 1)
        return Number.NaN;
    return Math.atanh(1 / number);
}
export function ASIN(number) {
    if (number > 1 || number < -1)
        return Number.NaN;
    return Math.asin(number);
}
export function ASINH(number) {
    return Math.asinh(number);
}
export function ATAN(number) {
    return Math.atan(number);
}
export function ATAN2(x, y) {
    if (y === 0 && x === 0)
        return Infinity;
    return Math.atan2(y, x);
}
export function ATANH(number) {
    if (Math.abs(number) > 1)
        return Number.NaN;
    return Math.atanh(number);
}
export function COS(number) {
    if (Math.abs(number) > MAX_NUMBER)
        return Number.NaN;
    const retValue = Math.cos(number);
    if (!isFinite(retValue))
        return Number.NaN;
    return retValue;
}
export function COSH(number) {
    const retValue = Math.cosh(number);
    if (!isFinite(retValue))
        return Number.NaN;
    return retValue;
}
export function COT(number) {
    if (Math.abs(number) > MAX_NUMBER)
        return Number.NaN;
    if (number === 0)
        return Infinity;
    return 1 / Math.tan(number);
}
export function COTH(number) {
    if (number === 0)
        return Infinity;
    return 1 / Math.tanh(number);
}
export function CSC(number) {
    if (Math.abs(number) > MAX_NUMBER)
        return Number.NaN;
    return 1 / Math.sin(number);
}
export function CSCH(number) {
    if (number === 0)
        return Infinity;
    return 1 / Math.sinh(number);
}
export function SEC(number) {
    if (Math.abs(number) > MAX_NUMBER)
        return Number.NaN;
    return 1 / Math.cos(number);
}
export function SECH(number) {
    return 1 / Math.cosh(number);
}
export function SIN(number) {
    if (Math.abs(number) > MAX_NUMBER)
        return Number.NaN;
    return Math.sin(number);
}
export function SINH(number) {
    const retValue = Math.sinh(number);
    if (!isFinite(retValue))
        return Number.NaN;
    return retValue;
}
export function TAN(number) {
    if (Math.abs(number) > MAX_NUMBER)
        return Number.NaN;
    return Math.tan(number);
}
export function TANH(number) {
    return Math.tanh(number);
}
