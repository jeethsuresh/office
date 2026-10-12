// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaError, FormulaContext } from '@sheetxl/primitives';
import { Types } from '../_utils/_Types';
import { FormulaHelpers } from '../_utils/_Helpers';
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const d1900 = new Date(Date.UTC(1900, 0, 1));
const WEEK_STARTS = [
    undefined, 0, 1, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, 1, 2, 3, 4, 5, 6, 0
];
const WEEK_TYPES = [
    undefined,
    [1, 2, 3, 4, 5, 6, 7],
    [7, 1, 2, 3, 4, 5, 6],
    [6, 0, 1, 2, 3, 4, 5],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    [7, 1, 2, 3, 4, 5, 6],
    [6, 7, 1, 2, 3, 4, 5],
    [5, 6, 7, 1, 2, 3, 4],
    [4, 5, 6, 7, 1, 2, 3],
    [3, 4, 5, 6, 7, 1, 2],
    [2, 3, 4, 5, 6, 7, 1],
    [1, 2, 3, 4, 5, 6, 7]
];
const WEEKEND_TYPES = [
    undefined,
    [6, 0],
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    undefined,
    undefined,
    undefined,
    [0],
    [1],
    [2],
    [3],
    [4],
    [5],
    [6]
];
const timeRegex = /^\s*(\d\d?)\s*(:\s*\d\d?)?\s*(:\s*\d\d?)?\s*(pm|am)?\s*$/i;
const dateRegex1 = /^\s*((\d\d?)\s*([-/])\s*(\d\d?))([\d:.apm\s]*)$/i;
const dateRegex2 = /^\s*((\d\d?)\s*([-/])\s*(jan\w*|feb\w*|mar\w*|apr\w*|may\w*|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*))([\d:.apm\s]*)$/i;
const dateRegex3 = /^\s*((jan\w*|feb\w*|mar\w*|apr\w*|may\w*|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s*([-/])\s*(\d\d?))([\d:.apm\s]*)$/i;
function parseSimplifiedDate(text) {
    const fmt1 = text.match(dateRegex1);
    const fmt2 = text.match(dateRegex2);
    const fmt3 = text.match(dateRegex3);
    if (fmt1) {
        text = fmt1[1] + fmt1[3] + new Date().getFullYear() + fmt1[5];
    }
    else if (fmt2) {
        text = fmt2[1] + fmt2[3] + new Date().getFullYear() + fmt2[5];
    }
    else if (fmt3) {
        text = fmt3[1] + fmt3[3] + new Date().getFullYear() + fmt3[5];
    }
    return new Date(Date.parse(`${text} UTC`));
}
function parseTime(text) {
    const res = text.match(timeRegex);
    if (!res)
        return;
    const minutes = res[2] ? res[2] : ':00';
    const seconds = res[3] ? res[3] : ':00';
    const ampm = res[4] ? ' ' + res[4] : '';
    const date = new Date(Date.parse(`1/1/1900 ${res[1] + minutes + seconds + ampm} UTC`));
    let now = new Date();
    now = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()));
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}
function toSerial(date) {
    let asTime = date.getTime?.() ?? date;
    const addOn = (asTime > -2203891200000) ? 2 : 1;
    return Math.floor((asTime - d1900.getTime()) / 86400000) + addOn;
}
function toDate(serial) {
    if (serial < 0) {
        throw FormulaError.BuiltIn.Value;
    }
    if (serial <= 60) {
        return new Date(d1900.getTime() + (serial - 1) * 86400000);
    }
    return new Date(d1900.getTime() + (serial - 2) * 86400000);
}
function parseDateWithExtra(serialOrString) {
    if (serialOrString instanceof Date)
        return { date: serialOrString };
    let isDateGiven = true;
    let date;
    if (!isNaN(serialOrString)) {
        serialOrString = Number(serialOrString);
        date = toDate(serialOrString);
    }
    else {
        date = parseTime(serialOrString);
        if (!date) {
            date = parseSimplifiedDate(serialOrString);
        }
        else {
            isDateGiven = false;
        }
    }
    return { date, isDateGiven };
}
function parseDate(serialOrString) {
    return parseDateWithExtra(serialOrString).date;
}
function compareDateIgnoreTime(date1, date2) {
    return date1.getUTCFullYear() === date2.getUTCFullYear()
        && date1.getUTCMonth() === date2.getUTCMonth()
        && date1.getUTCDate() === date2.getUTCDate();
}
function isLeapYear(year) {
    if (year === 1900) {
        return true;
    }
    return new Date(year, 1, 29).getMonth() === 1;
}
export function DATE(year, month, day) {
    if (year < 0 || year >= 10000)
        return Number.NaN;
    if (year < 1900) {
        year += 1900;
    }
    FormulaContext.formatResults(`Short Date`);
    return FormulaContext.toOADate(new Date(year, month - 1, day));
}
export function DATEDIF(startDate, endDate, unit) {
    const start = FormulaContext.fromOADate(startDate);
    const end = FormulaContext.fromOADate(endDate);
    unit = unit.toLowerCase();
    if (startDate > endDate)
        return Number.NaN;
    const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
    const monthDiff = end.getUTCMonth() - start.getUTCMonth();
    const dayDiff = end.getUTCDate() - start.getUTCDate();
    let offset;
    switch (unit) {
        case 'y':
            offset = monthDiff < 0 || monthDiff === 0 && dayDiff < 0 ? -1 : 0;
            return offset + yearDiff;
        case 'm':
            offset = dayDiff < 0 ? -1 : 0;
            return yearDiff * 12 + monthDiff + offset;
        case 'd':
            return Math.floor(end.getTime() - start.getTime()) / MS_PER_DAY;
        case 'md':
            start.setUTCFullYear(end.getUTCFullYear());
            if (dayDiff < 0) {
                start.setUTCMonth(end.getUTCMonth() - 1);
            }
            else {
                start.setUTCMonth(end.getUTCMonth());
            }
            return Math.floor(end.getTime() - start.getTime()) / MS_PER_DAY;
        case 'ym':
            offset = dayDiff < 0 ? -1 : 0;
            return (offset + yearDiff * 12 + monthDiff) % 12;
        case 'yd':
            if (monthDiff < 0 || monthDiff === 0 && dayDiff < 0) {
                start.setUTCFullYear(end.getUTCFullYear() - 1);
            }
            else {
                start.setUTCFullYear(end.getUTCFullYear());
            }
            return Math.floor(end.getTime() - start.getTime()) / MS_PER_DAY;
    }
}
export function DATESTRING(number) {
    return FormulaError.BuiltIn.NA;
}
export function DATEVALUE(dateText) {
    try {
        const asOADate = FormulaContext.parseAsDateTime(dateText);
        if (!asOADate)
            throw FormulaError.BuiltIn.Value;
        return Math.floor(asOADate);
    }
    catch (error) {
        throw FormulaError.BuiltIn.Value;
    }
}
export function DAY(serialOrString) {
    const date = parseDate(serialOrString);
    return date.getUTCDate();
}
export function DAYS(endDate, startDate) {
    return Math.trunc(endDate) - Math.trunc(startDate);
}
export function DAYS360(startDate, endDate, method = false) {
    const start = FormulaContext.fromOADate(startDate);
    const end = FormulaContext.fromOADate(endDate);
    if (start.getUTCDate() === 31) {
        start.setUTCDate(30);
    }
    if (!method && start.getUTCDate() < 30 && end.getUTCDate() > 30) {
        end.setUTCMonth(end.getUTCMonth() + 1, 1);
    }
    else {
        if (end.getUTCDate() === 31) {
            end.setUTCDate(30);
        }
    }
    const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
    const monthDiff = end.getUTCMonth() - start.getUTCMonth();
    const dayDiff = end.getUTCDate() - start.getUTCDate();
    return (monthDiff) * 30 + dayDiff + yearDiff * 12 * 30;
}
export function EDATE(startDate, months) {
    startDate.setUTCMonth(startDate.getUTCMonth() + months);
    return toSerial(startDate);
}
export function EOMONTH(startDate, months) {
    startDate.setUTCMonth(startDate.getUTCMonth() + months + 1, 0);
    return toSerial(startDate);
}
export function HOUR(serialOrString) {
    const date = parseDate(serialOrString);
    return date.getUTCHours();
}
export function ISOWEEKNUM(serialOrString) {
    const date = parseDate(serialOrString);
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
export function MINUTE(serialOrString) {
    const date = parseDate(serialOrString);
    return date.getUTCMinutes();
}
export function MONTH(serialOrString) {
    const date = parseDate(serialOrString);
    return date.getUTCMonth() + 1;
}
export function NETWORKDAYS(startDate, endDate, holidays = null) {
    let sign = 1;
    if (startDate > endDate) {
        sign = -1;
        const temp = startDate;
        startDate = endDate;
        endDate = temp;
    }
    const holidaysArr = [];
    if (holidays !== null) {
        FormulaHelpers.flattenParams([holidays], Types.NUMBER, false, item => {
            holidaysArr.push(parseDate(item));
        });
    }
    let numWorkDays = 0;
    while (startDate <= endDate) {
        if (startDate.getUTCDay() !== 0 && startDate.getUTCDay() !== 6) {
            let found = false;
            for (let i = 0; i < holidaysArr.length; i++) {
                if (compareDateIgnoreTime(startDate, holidaysArr[i])) {
                    found = true;
                    break;
                }
            }
            if (!found)
                numWorkDays++;
        }
        startDate.setUTCDate(startDate.getUTCDate() + 1);
    }
    return sign * numWorkDays;
}
export function NETWORKDAYS_INTL(startDate, endDate, weekend = 1, holidays = null) {
    startDate = parseDate(startDate);
    endDate = parseDate(endDate);
    let sign = 1;
    if (startDate > endDate) {
        sign = -1;
        const temp = startDate;
        startDate = endDate;
        endDate = temp;
    }
    if (weekend === '1111111')
        return 0;
    if (typeof weekend === "string" && Number(weekend).toString() !== weekend) {
        if (weekend.length !== 7)
            throw FormulaError.BuiltIn.Value;
        weekend = weekend.charAt(6) + weekend.slice(0, 6);
        const weekendArr = [];
        for (let i = 0; i < weekend.length; i++) {
            if (weekend.charAt(i) === '1')
                weekendArr.push(i);
        }
        weekend = weekendArr;
    }
    else {
        if (typeof weekend !== "number")
            throw FormulaError.BuiltIn.Value;
        weekend = WEEKEND_TYPES[weekend];
    }
    const holidaysArr = [];
    if (holidays != null) {
        FormulaHelpers.flattenParams([holidays], Types.NUMBER, false, item => {
            holidaysArr.push(parseDate(item));
        });
    }
    let numWorkDays = 0;
    while (startDate <= endDate) {
        let skip = false;
        for (let i = 0; i < weekend.length; i++) {
            if (weekend[i] === startDate.getUTCDay()) {
                skip = true;
                break;
            }
        }
        if (!skip) {
            let found = false;
            for (let i = 0; i < holidaysArr.length; i++) {
                if (compareDateIgnoreTime(startDate, holidaysArr[i])) {
                    found = true;
                    break;
                }
            }
            if (!found)
                numWorkDays++;
        }
        startDate.setUTCDate(startDate.getUTCDate() + 1);
    }
    return sign * numWorkDays;
}
export function NOW() {
    const now = new Date();
    const oaDate = toSerial(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()))
        + (3600 * now.getHours() + 60 * now.getMinutes() + now.getSeconds()) / 86400;
    FormulaContext.markVolatile();
    FormulaContext.formatResults(`Short Date Short Time`);
    return oaDate;
}
export function SECOND(serialOrString) {
    const date = parseDate(serialOrString);
    return date.getUTCSeconds();
}
export function TIME(hour, minute, second) {
    if (hour < 0 || hour > 32767 || minute < 0 || minute > 32767 || second < 0 || second > 32767)
        return Number.NaN;
    FormulaContext.formatResults(`Medium Time`);
    return (3600 * hour + 60 * minute + second) / 86400;
}
export function TIMEVALUE(timeText) {
    const asDate = parseDate(timeText);
    return (3600 * asDate.getUTCHours() + 60 * asDate.getUTCMinutes() + asDate.getUTCSeconds()) / 86400;
}
export function TODAY() {
    FormulaContext.formatResults(`Short Date`);
    const now = new Date();
    return FormulaContext.toOADate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}
export function WEEKDAY(serialOrString, returnType = 1) {
    const asDate = parseDate(serialOrString);
    const day = asDate.getUTCDay();
    const weekTypes = WEEK_TYPES[returnType];
    if (!weekTypes)
        throw FormulaError.BuiltIn.Num;
    return weekTypes[day];
}
export function WEEKNUM(serialOrString, returnType = 1) {
    const asDate = parseDate(serialOrString);
    if (returnType === 21) {
        return ISOWEEKNUM(serialOrString);
    }
    const weekStart = WEEK_STARTS[returnType];
    const yearStart = new Date(Date.UTC(asDate.getUTCFullYear(), 0, 1));
    const offset = yearStart.getUTCDay() < weekStart ? 1 : 0;
    return Math.ceil((((asDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7) + offset;
}
export function WORKDAY(startDate, days, holidays = null) {
    return WORKDAY_INTL(startDate, days, 1, holidays);
}
export function WORKDAY_INTL(startDate, days, weekend = 1, holidays = null) {
    startDate = parseDate(startDate);
    if (weekend === '1111111')
        throw FormulaError.BuiltIn.Value;
    if (typeof weekend === "string" && Number(weekend).toString() !== weekend) {
        if (weekend.length !== 7)
            throw FormulaError.BuiltIn.Value;
        weekend = weekend.charAt(6) + weekend.slice(0, 6);
        const weekendArr = [];
        for (let i = 0; i < weekend.length; i++) {
            if (weekend.charAt(i) === '1')
                weekendArr.push(i);
        }
        weekend = weekendArr;
    }
    else {
        if (typeof weekend !== "number")
            throw FormulaError.BuiltIn.Value;
        weekend = WEEKEND_TYPES[weekend];
        if (weekend == null)
            throw FormulaError.BuiltIn.Num;
    }
    const holidaysArr = [];
    if (holidays != null) {
        FormulaHelpers.flattenParams([holidays], Types.NUMBER, false, item => {
            holidaysArr.push(parseDate(item));
        });
    }
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    let cnt = 0;
    while (cnt < days) {
        let skip = false;
        for (let i = 0; i < weekend.length; i++) {
            if (weekend[i] === startDate.getUTCDay()) {
                skip = true;
                break;
            }
        }
        if (!skip) {
            let found = false;
            for (let i = 0; i < holidaysArr.length; i++) {
                if (compareDateIgnoreTime(startDate, holidaysArr[i])) {
                    found = true;
                    break;
                }
            }
            if (!found)
                cnt++;
        }
        startDate.setUTCDate(startDate.getUTCDate() + 1);
    }
    return toSerial(startDate) - 1;
}
export function YEAR(serialOrString) {
    const asDate = parseDate(serialOrString);
    return asDate.getUTCFullYear();
}
export function YEARFRAC(startDate, endDate, basis = 0) {
    let start = FormulaContext.fromOADate(startDate);
    let end = FormulaContext.fromOADate(endDate);
    if (start > end) {
        const temp = start;
        start = end;
        end = temp;
        const tempDate = startDate;
        startDate = endDate;
        endDate = tempDate;
    }
    basis = Math.trunc(basis);
    if (basis < 0 || basis > 4)
        throw FormulaError.BuiltIn.Value;
    let sd = start.getUTCDate();
    const sm = start.getUTCMonth() + 1;
    const sy = start.getUTCFullYear();
    let ed = end.getUTCDate();
    const em = end.getUTCMonth() + 1;
    const ey = end.getUTCFullYear();
    switch (basis) {
        case 0:
            if (sd === 31 && ed === 31) {
                sd = 30;
                ed = 30;
            }
            else if (sd === 31) {
                sd = 30;
            }
            else if (sd === 30 && ed === 31) {
                ed = 30;
            }
            return Math.abs((ed + em * 30 + ey * 360) - (sd + sm * 30 + sy * 360)) / 360;
        case 1:
            if (ey - sy < 2) {
                const yLength = isLeapYear(sy) && sy !== 1900 ? 366 : 365;
                const days = DAYS(endDate, startDate);
                return days / yLength;
            }
            else {
                const years = (ey - sy) + 1;
                const dateEnd = new Date(ey + 1, 0, 1);
                const dateStart = new Date(sy, 0, 1);
                const days = (dateEnd.getTime() - dateStart.getTime()) / 1000 / 60 / 60 / 24;
                const average = days / years;
                return DAYS(endDate, startDate) / average;
            }
        case 2:
            return Math.abs(DAYS(endDate, startDate) / 360);
        case 3:
            return Math.abs(DAYS(endDate, startDate) / 365);
        case 4:
            return Math.abs((ed + em * 30 + ey * 360) - (sd + sm * 30 + sy * 360)) / 360;
    }
}
