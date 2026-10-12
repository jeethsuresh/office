// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
export function DELTA(number1, number2 = 0) {
    return number1 === number2 ? 1 : 0;
}
export function GESTEP(number, step = 0) {
    return number >= step ? 1 : 0;
}
