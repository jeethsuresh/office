// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaError } from '@sheetxl/primitives';
const MAX_OCT = 536870911;
const MIN_OCT = -536870912;
const MAX_BIN = 511;
const MIN_BIN = -512;
const toBitValue = (number) => {
    const type = typeof number;
    if (type === 'boolean') {
        return number ? 1 : 0;
    }
    if (type === 'number') {
        if (number < 0 || number > 281474976710655 || Math.floor(number) !== number)
            throw FormulaError.BuiltIn.Num;
        return number;
    }
    if (type === 'string') {
        let asNumber = 0;
        try {
            asNumber = number * 1;
        }
        catch (e) { }
        if (Number.isFinite(asNumber)) {
            return asNumber;
        }
    }
    throw FormulaError.BuiltIn.Value;
};
export function BIN2DEC(number) {
    const numberStr = number.toString();
    if (numberStr.length > 10)
        return Number.NaN;
    if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
        return parseInt(numberStr.substring(1), 2) + MIN_BIN;
    }
    else {
        return parseInt(numberStr, 2);
    }
}
export function BIN2HEX(number, places) {
    const numberStr = number.toString();
    if (numberStr.length > 10)
        throw FormulaError.BuiltIn.Num;
    if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
        return (parseInt(numberStr.substring(1), 2) + 1099511627264).toString(16).toUpperCase();
    }
    const result = parseInt(number, 2).toString(16);
    if (places === undefined) {
        return result.toUpperCase();
    }
    if (places < 0)
        throw FormulaError.BuiltIn.Num;
    places = Math.trunc(places);
    if (places >= result.length) {
        return ('0'.repeat(places - result.length) + result).toUpperCase();
    }
    throw FormulaError.BuiltIn.Num;
}
export function BIN2OCT(number, places) {
    let numberStr = number.toString();
    if (numberStr.length > 10)
        throw FormulaError.BuiltIn.Num;
    if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
        return (parseInt(numberStr.substring(1), 2) + 1073741312).toString(8);
    }
    const result = parseInt(number, 2).toString(8);
    if (places === undefined) {
        return result.toUpperCase();
    }
    if (places < 0)
        throw FormulaError.BuiltIn.Num;
    places = Math.trunc(places);
    if (places >= result.length) {
        return ('0'.repeat(places - result.length) + result);
    }
    throw FormulaError.BuiltIn.Num;
}
export function BITAND(number1, number2) {
    number1 = toBitValue(number1);
    number2 = toBitValue(number2);
    return number1 & number2;
}
export function BITLSHIFT(number, shiftAmount) {
    number = toBitValue(number);
    shiftAmount = Math.trunc(shiftAmount);
    if (Math.abs(shiftAmount) > 53)
        return Number.NaN;
    const result = (shiftAmount >= 0) ? number * 2 ** shiftAmount : Math.trunc(number / 2 ** -shiftAmount);
    if (result > 281474976710655)
        return Number.NaN;
    return result;
}
export function BITOR(number1, number2) {
    number1 = toBitValue(number1);
    number2 = toBitValue(number2);
    return number1 | number2;
}
export function BITRSHIFT(number, shiftAmount) {
    number = toBitValue(number);
    return BITLSHIFT(number, -shiftAmount);
}
export function BITXOR(number1, number2) {
    number1 = toBitValue(number1);
    number2 = toBitValue(number2);
    return number1 ^ number2;
}
export function DEC2BIN(number, places) {
    if (number < MIN_BIN || number > MAX_BIN)
        throw FormulaError.BuiltIn.Num;
    if (number < 0) {
        return '1' + '0'.repeat(9 - (512 + number).toString(2).length) + (512 + number).toString(2);
    }
    const result = parseInt(number, 10).toString(2);
    if (places === undefined) {
        return result;
    }
    places = Math.trunc(places);
    if (places <= 0)
        throw FormulaError.BuiltIn.Num;
    if (places < result.length)
        throw FormulaError.BuiltIn.Num;
    return ('0'.repeat(places - result.length) + result);
}
export function DEC2HEX(number, places) {
    if (number < -549755813888 || number > 549755813888)
        throw FormulaError.BuiltIn.Num;
    if (number < 0) {
        return (1099511627776 + number).toString(16).toUpperCase();
    }
    const result = parseInt(number, 10).toString(16);
    if (places === undefined) {
        return result.toUpperCase();
    }
    places = Math.trunc(places);
    if (places <= 0)
        throw FormulaError.BuiltIn.Num;
    if (places < result.length)
        throw FormulaError.BuiltIn.Num;
    return '0'.repeat(places - result.length) + result.toUpperCase();
}
export function DEC2OCT(number, places) {
    if (number < -536870912 || number > 536870912)
        throw FormulaError.BuiltIn.Num;
    if (number < 0) {
        return (number + 1073741824).toString(8);
    }
    const result = parseInt(number, 10).toString(8);
    if (places === undefined) {
        return result.toUpperCase();
    }
    places = Math.trunc(places);
    if (places <= 0)
        throw FormulaError.BuiltIn.Num;
    if (places < result.length)
        throw FormulaError.BuiltIn.Num;
    return '0'.repeat(places - result.length) + result;
}
export function HEX2BIN(number, places) {
    if (number.length > 10 || !/^[0-9a-fA-F]*$/.test(number))
        return Number.NaN;
    const ifNegative = (number.length === 10 && number.substring(0, 1).toLowerCase() === 'f');
    const toDecimal = ifNegative ? parseInt(number, 16) - 1099511627776 : parseInt(number, 16);
    if (toDecimal < MIN_BIN || toDecimal > MAX_BIN)
        return Number.NaN;
    if (ifNegative) {
        return '1' + '0'.repeat(9 - (toDecimal + 512).toString(2).length) + (toDecimal + 512).toString(2);
    }
    const toBinary = toDecimal.toString(2);
    if (places === undefined) {
        return toBinary;
    }
    places = Math.trunc(places);
    if (places <= 0 || places < toBinary.length)
        return Number.NaN;
    return '0'.repeat(places - toBinary.length) + toBinary;
}
export function HEX2DEC(number) {
    if (!/^[0-9A-Fa-f]{1,10}$/.test(number))
        return Number.NaN;
    const decimal = parseInt(number, 16);
    return decimal >= 549755813888 ? decimal - 1099511627776 : decimal;
}
export function HEX2OCT(number, places) {
    if (number.length > 10 || !/^[0-9a-fA-F]*$/.test(number))
        throw FormulaError.BuiltIn.Num;
    const toDecimal = HEX2DEC(number);
    if (toDecimal > MAX_OCT || toDecimal < MIN_OCT)
        throw FormulaError.BuiltIn.Num;
    return DEC2OCT(toDecimal, places);
}
export function OCT2BIN(number, places) {
    if (number.length > 10)
        throw FormulaError.BuiltIn.Num;
    if (places > 10)
        throw FormulaError.BuiltIn.Num;
    if (places !== undefined && places < 0)
        throw FormulaError.BuiltIn.Num;
    places = Math.trunc(places);
    const isNegative = (number.length === 10 && number.substring(0, 1) === '7');
    const toDecimal = OCT2DEC(number);
    if (toDecimal < MIN_BIN || toDecimal > MAX_BIN)
        throw FormulaError.BuiltIn.Num;
    if (isNegative) {
        return '1' + '0'.repeat(9 - (512 + toDecimal).toString(2).length) + (512 + toDecimal).toString(2);
    }
    const result = toDecimal.toString(2);
    if (places === 0) {
        return result;
    }
    if (places < result.length)
        throw FormulaError.BuiltIn.Num;
    return '0'.repeat(places - result.length) + result;
}
export function OCT2DEC(number) {
    if (number.length > 10)
        throw FormulaError.BuiltIn.Num;
    for (const n of number) {
        if (n < '0' || n > '7')
            throw FormulaError.BuiltIn.Num;
    }
    const result = parseInt(number, 8);
    return (result >= 536870912) ? result - 1073741824 : result;
}
export function OCT2HEX(number, places) {
    if (number.length > 10)
        return Number.NaN;
    for (const n of number) {
        if (n < '0' || n > '7')
            return Number.NaN;
    }
    places = Math.trunc(places);
    if (places < 0 || places > 10)
        return Number.NaN;
    const toDecimal = OCT2DEC(number);
    const toHex = DEC2HEX(toDecimal);
    if (places === 0)
        return toHex;
    if (places < toHex.length)
        return Number.NaN;
    return '0'.repeat(places - toHex.length) + toHex;
}
