// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaError } from '@sheetxl/primitives';
export const WildCard = {
    isWildCard: (obj) => {
        if (typeof obj === "string")
            return /[*?]/.test(obj);
        return false;
    },
    toRegex: (lookupText, flags) => {
        return RegExp(lookupText.replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/([^~]??)[?]/g, '$1.')
            .replace(/([^~]??)[*]/g, '$1.*')
            .replace(/~([?*])/g, '$1'), flags);
    }
};
export const Criteria = {
    parse: (criteria) => {
        const type = typeof criteria;
        if (type === "string") {
            const upper = criteria.toUpperCase();
            if (upper === 'TRUE' || upper === 'FALSE') {
                return { op: '=', value: upper === 'TRUE' };
            }
            const res = criteria.match(/(<>|>=|<=|>|<|=)(.*)/);
            if (res) {
                let op = res[1];
                let value;
                if (isNaN(res[2])) {
                    const upper = res[2].toUpperCase();
                    if (upper === 'TRUE' || upper === 'FALSE') {
                        value = upper === 'TRUE';
                    }
                    else if (/#NULL!|#DIV\/0!|#FIELD!|#VALUE!|#NAME\?|#NUM!|#N\/A|#REF!/.test(res[2])) {
                        value = FormulaError.getBuiltInByLabel(res[2]);
                    }
                    else {
                        value = res[2];
                        if (WildCard.isWildCard(value)) {
                            return { op: 'wc', value: WildCard.toRegex(value), match: op === '=' };
                        }
                    }
                }
                else {
                    value = Number(res[2]);
                }
                return { op, value };
            }
            else if (WildCard.isWildCard(criteria)) {
                return { op: 'wc', value: WildCard.toRegex(criteria), match: true };
            }
            else {
                return { op: '=', value: criteria };
            }
        }
        else if (type === "boolean" || type === 'number' || (Array.isArray(criteria)
            || criteria instanceof FormulaError.Known)) {
            return { op: '=', value: criteria };
        }
        else {
            throw Error(`Criteria.parse: type ${typeof criteria} not support`);
        }
    }
};
