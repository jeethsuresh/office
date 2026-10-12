// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { bahttext } from 'bahttext';
export function BAHTTEXT(number) {
    try {
        return bahttext(number);
    }
    catch (e) {
        throw Error(`Error in https://github.com/jojoee/bahttext \n${e.toString()}`);
    }
}
