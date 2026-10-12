// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import bessel from 'bessel';
export function BESSELI(x, n) {
    n = Math.trunc(n);
    if (n < 0)
        return Number.NaN;
    return bessel.besseli(x, n);
}
export function BESSELJ(x, n) {
    n = Math.trunc(n);
    if (n < 0)
        return Number.NaN;
    return bessel.besselj(x, n);
}
export function BESSELK(x, n) {
    n = Math.trunc(n);
    if (n < 0)
        return Number.NaN;
    return bessel.besselk(x, n);
}
export function BESSELY(x, n) {
    n = Math.trunc(n);
    if (n < 0)
        return Number.NaN;
    return bessel.bessely(x, n);
}
