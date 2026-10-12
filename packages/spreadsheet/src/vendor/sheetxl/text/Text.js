// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { ScalarType, IRange, FormulaContext, FormulaError } from '@sheetxl/primitives';
import { WildCard } from '../_utils';
const charSets = {
    latin: { halfRE: /[!-~]/g, fullRE: /[！-～]/g, delta: 0xFEE0 },
    hangul1: { halfRE: /[ﾡ-ﾾ]/g, fullRE: /[ᆨ-ᇂ]/g, delta: -0xEDF9 },
    hangul2: { halfRE: /[ￂ-ￜ]/g, fullRE: /[ᅡ-ᅵ]/g, delta: -0xEE61 },
    kana: {
        delta: 0,
        half: "｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ",
        full: "。「」、・ヲァィゥェォャュョッーアイウエオカキクケコサシ" +
            "スセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン゛゜"
    },
    extras: {
        delta: 0,
        half: "¢£¬¯¦¥₩\u0020|←↑→↓■°",
        full: "￠￡￢￣￤￥￦\u3000￨￩￪￫￬￭￮"
    }
};
const toFull = set => c => set.delta ?
    String.fromCharCode(c.charCodeAt(0) + set.delta) :
    [...set.full][[...set.half].indexOf(c)];
const toHalf = set => c => set.delta ?
    String.fromCharCode(c.charCodeAt(0) - set.delta) :
    [...set.half][[...set.full].indexOf(c)];
const re = (set, way) => set[way + "RE"] || new RegExp("[" + set[way] + "]", "g");
const sets = Object.keys(charSets).map(i => charSets[i]);
const toFullWidth = (str0) => {
    return sets.reduce((str, set) => str.replace(re(set, "half"), toFull(set)), str0);
};
const toHalfWidth = (str0) => sets.reduce((str, set) => str.replace(re(set, "full"), toHalf(set)), str0);
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function ASC(text) {
    return toHalfWidth(text);
}
export function ARRAYTOTEXT(array, format = 0) {
    format = Math.floor(format);
    if (format !== 0 && format !== 1) {
        throw FormulaError.BuiltIn.Value;
    }
    const strict = format === 1;
    let results = null;
    if (!strict) {
        for (const value of array.values({ orientation: IRange.Orientation.Row })) {
            results = results === null ? '' : results + ', ';
            results += VALUETOTEXT(value, format);
        }
        return results;
    }
    const asArray = array.getValues();
    results = '{';
    for (let i = 0; i < asArray.length; i++) {
        const row = asArray[i];
        for (let j = 0; j < row.length; j++) {
            results += VALUETOTEXT(row[j], format);
            if (j < row.length - 1) {
                results += ',';
            }
        }
        if (i < asArray.length - 1) {
            results += ';';
        }
    }
    if (strict) {
        results += '}';
    }
    return results;
}
export function CHAR(number) {
    if (number > 255 || number < 1)
        throw FormulaError.BuiltIn.Value;
    return String.fromCharCode(number);
}
export function CLEAN(text) {
    return text.replace(/[\x00-\x1F]/g, '');
}
export function CODE(text) {
    if (text.length === 0)
        throw FormulaError.BuiltIn.Value;
    return text.charCodeAt(0);
}
export function CONCAT(...text) {
    let result = '';
    let count = 0;
    for (const range of text) {
        for (const value of range.values({ type: ScalarType.String, coerce: true, orientation: IRange.Orientation.Row })) {
            if (count++ > 254)
                throw FormulaError.Value;
            result += value;
        }
    }
    return result;
}
export function CONCATENATE(...text) {
    let result = '';
    let count = 0;
    for (const range of text) {
        const value = range.getValueAt(0, 0, { type: ScalarType.String, coerce: true });
        if (count++ > 254)
            throw FormulaError.Value;
        result += value;
    }
    return result;
}
export function DETECTLANGUAGE(text) {
    return undefined;
}
export function DBCS(text) {
    return toFullWidth(text);
}
export function DOLLAR(number, decimals = 2) {
    const decimalString = Array(decimals).fill('0').join('');
    const runtime = FormulaContext.getRuntime();
    const currency = runtime.getCurrencySymbol();
    const group = runtime.getNumberGroupSeparator();
    const decimal = runtime.getNumberDecimalSeparator();
    const formatText = `${currency}#${group}##0${decimal}${decimalString}_);(${currency}#${group}##0${decimal}${decimalString})`;
    return FormulaContext.getNumberFormat(formatText, number).trim();
}
export function EXACT(text1, text2) {
    return text1 === text2;
}
export function FIND(findText, withinText, startNum = 1) {
    if (startNum < 1 || startNum > withinText.length)
        throw FormulaError.BuiltIn.Value;
    const res = withinText.indexOf(findText, startNum - 1);
    if (res === -1)
        throw FormulaError.BuiltIn.Value;
    return res + 1;
}
export function FINDB(findText, withinText, startNum = 1) {
    return FIND(findText, withinText, startNum);
}
export function FIXED(number, decimals = 2, noCommas = false) {
    const decimalString = Array(decimals).fill('0').join('');
    const runtime = FormulaContext.getRuntime();
    const group = runtime.getNumberGroupSeparator();
    const decimal = runtime.getNumberDecimalSeparator();
    const comma = noCommas ? '' : `#${group}`;
    const formatText = `${comma}##0${decimal}${decimalString}_);(${comma}##0${decimal}${decimalString})`;
    return FormulaContext.getNumberFormat(formatText, number).trim();
}
export function LEFT(text, numChars = 1) {
    if (numChars < 0)
        throw FormulaError.BuiltIn.Value;
    if (numChars > text.length)
        return text;
    return text.slice(0, numChars);
}
export function LEFTB(text, numBytes = 1) {
    return LEFT(text, numBytes);
}
export function LEN(text) {
    return text.length;
}
export function LENB(text) {
    return text.length;
}
export function LOWER(text) {
    return text.toLowerCase();
}
export function MID(text, startNum, numChars) {
    if (startNum > text.length)
        return '';
    if (startNum < 1 || numChars < 1)
        throw FormulaError.BuiltIn.Value;
    return text.slice(startNum - 1, startNum + numChars - 1);
}
export function MIDB(text, startNum, numBytes) {
    return MID(text, startNum, numBytes);
}
export function NUMBERVALUE(text, decimalSeparator = '.', groupSeparator = ',') {
    if (text.length === 0)
        return 0;
    if (decimalSeparator.length === 0 || groupSeparator.length === 0)
        throw FormulaError.BuiltIn.Value;
    decimalSeparator = decimalSeparator[0];
    groupSeparator = groupSeparator[0];
    if (decimalSeparator === groupSeparator
        || text.indexOf(decimalSeparator) < text.lastIndexOf(groupSeparator))
        throw FormulaError.BuiltIn.Value;
    const res = text.replace(groupSeparator, '')
        .replace(decimalSeparator, '.')
        .replace(/[^\-0-9.%()]/g, '')
        .match(/([(-]*)([0-9]*[.]*[0-9]+)([)]?)([%]*)/);
    if (!res)
        throw FormulaError.BuiltIn.Value;
    const leftParenOrMinus = res[1].length, rightParen = res[3].length, percent = res[4].length;
    let number = Number(res[2]);
    if (leftParenOrMinus > 1 || leftParenOrMinus && !rightParen
        || !leftParenOrMinus && rightParen || isNaN(number))
        throw FormulaError.BuiltIn.Value;
    number = number / 100 ** percent;
    return leftParenOrMinus ? -number : number;
}
export function PERCENTOF(dataSubset, dataAll) {
    return undefined;
}
export function PHONETIC(reference) {
}
export function PROPER(text) {
    text = text.toLowerCase();
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return text.replace(/(?:[^a-zA-Z])([a-zA-Z])/g, letter => letter.toUpperCase());
}
export function REGEXEXTRACT(text, pattern, returnMode = 0, caseSensitivity = false) {
    return undefined;
}
export function REGEXREPLACE(text, pattern, replacement, occurrence = 0, caseSensitivity = false) {
    return undefined;
}
export function REGEXTEST(text, pattern, caseSensitivity = false) {
    return undefined;
}
export function REPLACE(oldText, startNum, numChars, newText) {
    let arr = oldText.split("");
    arr.splice(startNum - 1, numChars, newText);
    return arr.join("");
}
export function REPLACEB(oldText, startNum, numBytes, newText) {
    return REPLACE(oldText, startNum, numBytes, newText);
}
export function REPT(text, numberTimes) {
    let str = "";
    for (let i = 0; i < numberTimes; i++) {
        str += text;
    }
    return str;
}
export function RIGHT(text, numChars = 1) {
    if (numChars < 0)
        throw FormulaError.BuiltIn.Value;
    const len = text.length;
    if (numChars > len)
        return text;
    return text.slice(len - numChars);
}
export function RIGHTB(text, numBytes = 1) {
    return RIGHT(text, numBytes);
}
export function SEARCH(findText, withinText, startNum = 1) {
    if (startNum < 1 || startNum > withinText.length)
        throw FormulaError.BuiltIn.Value;
    let findTextRegex = WildCard.isWildCard(findText) ? WildCard.toRegex(findText, 'i') : findText;
    const res = withinText.slice(startNum - 1).search(findTextRegex);
    if (res === -1)
        throw FormulaError.BuiltIn.Value;
    return res + startNum;
}
export function SEARCHB(findText, withinText, startBytes = 1) {
    return SEARCH(findText, withinText, startBytes);
}
export function SUBSTITUTE(text, oldText, newText, instanceNum) {
    if (!text || !oldText)
        return text;
    if (instanceNum === undefined) {
        instanceNum = -1;
    }
    else {
        instanceNum = Math.floor(instanceNum);
        if (instanceNum <= 0)
            throw new FormulaError.Value();
    }
    let result = text;
    let currentIndex = 0;
    let count = 0;
    while ((currentIndex = result.indexOf(oldText, currentIndex)) !== -1) {
        ++count;
        if (count === instanceNum || instanceNum === -1) {
            result = result.substring(0, currentIndex) + newText + result.substring(currentIndex + oldText.length);
        }
        currentIndex += oldText.length;
    }
    return result;
}
export function T(value) {
    return (typeof value === "string") ? value : '';
}
export function TEXT(value, formatText) {
    try {
        return FormulaContext.getNumberFormat(formatText, value);
    }
    catch (e) {
        throw FormulaError.BuiltIn.Value;
    }
}
export function TEXTAFTER(text, delimiter, instanceNum = 1, matchMode = 0, matchEnd = 0, ifNotFound = undefined) {
    if (!text || !delimiter)
        return FormulaError.BuiltIn.Value;
    instanceNum = Math.floor(instanceNum);
    if (instanceNum <= 0) {
        throw FormulaError.BuiltIn.Value;
    }
    let searchText = text;
    let searchDelimiter = delimiter;
    if (matchMode === 1) {
        searchText = text.toLowerCase();
        searchDelimiter = delimiter.toLowerCase();
    }
    let position = -1;
    let count = 0;
    while (count < instanceNum) {
        position = searchText.indexOf(searchDelimiter, position + 1);
        if (position === -1)
            return ifNotFound ?? FormulaError.BuiltIn.NA;
        count++;
    }
    const result = text.substring(position + delimiter.length);
    return matchEnd === 1 && result.length === 0 ? '' : result;
}
export function TEXTJOIN(delimiter, ignoreEmpty, ...text) {
    let result = '';
    for (const range of text) {
        for (const value of range.values({
            type: ScalarType.String,
            coerce: true,
            orientation: IRange.Orientation.Row,
            includeEmpty: !ignoreEmpty
        })) {
            if (value.length === 0 && ignoreEmpty)
                continue;
            if (result.length > 0) {
                result += delimiter;
            }
            result += value;
        }
    }
    return result;
}
export function TEXTSPLIT(text, colDelimiter, rowDelimiter = null, ignoreEmpty = false, matchMode = 0, padWith = undefined) {
    if (!text)
        return [[""]];
    if (matchMode !== 0 && matchMode !== 1)
        throw FormulaError.BuiltIn.Value;
    const splitByDelimiters = (input, delimiters, caseInsensitive) => {
        if (delimiters.length === 0)
            return [input];
        const regex = new RegExp(delimiters.map(d => escapeRegex(d)).join('|'), caseInsensitive ? 'gi' : 'g');
        return input.split(regex);
    };
    let rows = [text];
    if (rowDelimiter) {
        rows = splitByDelimiters(text, rowDelimiter, matchMode === 1);
    }
    if (ignoreEmpty) {
        const filtered = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.length > 0) {
                filtered.push(row);
            }
        }
        rows = filtered;
    }
    const result = [];
    let maxColumns = 0;
    let minColumns = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let columns = splitByDelimiters(row, colDelimiter, matchMode === 1);
        if (ignoreEmpty) {
            const filtered = [];
            for (let i = 0; i < columns.length; i++) {
                const value = columns[i];
                if (value.length > 0) {
                    filtered.push(value);
                }
            }
            columns = filtered;
        }
        if (columns.length > 0 || !ignoreEmpty) {
            result.push(columns);
            maxColumns = Math.max(maxColumns, columns.length);
            minColumns = Math.min(minColumns, columns.length);
        }
    }
    if (result.length > 0 && minColumns !== maxColumns) {
        const padValue = padWith || FormulaError.BuiltIn.NA;
        for (let i = 0; i < result.length; i++) {
            const row = result[i];
            while (row.length < maxColumns) {
                row.push(padValue);
            }
        }
    }
    return result.length > 0 ? result : [[""]];
}
export function TEXTBEFORE(text, delimiter, instanceNum = 1, matchMode = 0, matchEnd = 0, ifNotFound = undefined) {
    if (!text || !delimiter)
        return FormulaError.BuiltIn.Value;
    instanceNum = Math.floor(instanceNum);
    if (instanceNum <= 0) {
        throw FormulaError.BuiltIn.Value;
    }
    let searchText = text;
    let searchDelimiter = delimiter;
    if (matchMode === 1) {
        searchText = text.toLowerCase();
        searchDelimiter = delimiter.toLowerCase();
    }
    let position = -1;
    let count = 0;
    while (count < instanceNum) {
        position = searchText.indexOf(searchDelimiter, position + 1);
        if (position === -1)
            return ifNotFound ?? FormulaError.BuiltIn.NA;
        count++;
    }
    const result = text.substring(0, position);
    return matchEnd === 1 && result.length === 0 ? "" : result;
}
export function TRANSLATE(text, sourceLanguage, targetLanguage) {
    return undefined;
}
export function TRIM(text) {
    return text.replace(/^\s+|\s+$/g, '');
}
export function UNICHAR(number) {
    if (number <= 0)
        throw FormulaError.BuiltIn.Value;
    return String.fromCharCode(number);
}
export function UNICODE(text) {
    return CODE(text);
}
export function UPPER(text) {
    return text.toUpperCase();
}
export function VALUE(text) {
    const number = Number(text);
    if (isNaN(number))
        throw FormulaError.BuiltIn.Value;
    return number;
}
export function VALUETOTEXT(value, format = 0) {
    format = Math.floor(format);
    if (format !== 0 && format !== 1) {
        throw FormulaError.BuiltIn.Value;
    }
    const strict = format === 1;
    if (value === null) {
    }
    else if (typeof value === 'string') {
        return strict ? '"' + value + '"' : value;
    }
    else if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
    }
    else {
        return value.toString();
    }
    return '';
}
