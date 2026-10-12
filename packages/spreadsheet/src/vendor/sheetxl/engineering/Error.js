// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import jStat from 'jstat';
export function ERF(lowerLimit, upperLimit = 0) {
    return jStat.erf(lowerLimit);
}
export function ERF_PRECISE(x) {
    return jStat.erf(x);
}
export function ERFC(x) {
    return jStat.erfc(x);
}
