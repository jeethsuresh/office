// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaContext, FormulaError } from '@sheetxl/primitives';
export function CELL(infoType, reference) {
    let retValue = null;
    switch (infoType) {
        case 'address':
            const coords = reference.getCoords();
            retValue = FormulaContext.getAddress({
                colIndex: coords.colStart,
                $colIndex: true,
                rowIndex: coords.rowStart,
                $rowIndex: true
            });
            break;
        case 'col':
            retValue = reference.getCoords().colStart + 1;
            break;
        case 'contents':
            retValue = reference.getValueAt(0, 0);
            break;
        case 'row':
            retValue = reference.getCoords().colStart + 1;
            break;
        case 'type':
            const value = reference.getValueAt(0, 0);
            if (value === null) {
                retValue = 'b';
            }
            else if (typeof value === 'string') {
                retValue = 'l';
            }
            else {
                retValue = 'v';
            }
            break;
        default:
            retValue = FormulaError.BuiltIn.Value;
    }
    FormulaContext.markVolatile();
    return retValue;
}
export function ERROR_TYPE(errorVal) {
    return errorVal
        .map((scalar) => {
        if (scalar instanceof FormulaError.Known) {
            return scalar.getCode();
        }
        return FormulaError.BuiltIn.NA;
    })
        .fillEmpty(true);
}
export function INFO(typeText) {
    typeText = typeText.toUpperCase();
    if (typeText === 'DIRECTORY') {
        try {
            FormulaContext.markVolatile();
            return FormulaContext.getRuntime().getLocation();
        }
        catch (e) { }
        return '..';
    }
    if (typeText === 'NUMFILE') {
        return '1';
    }
    if (typeText === 'ORIGIN') {
        return '$A$1';
    }
    if (typeText === 'RECALC') {
        return '1';
    }
    if (typeText === 'RELEASE') {
        return FormulaContext.getRuntime().getVersion();
    }
    if (typeText === 'OSVERSION') {
        return '1';
    }
    if (typeText === 'SYSTEM') {
        return FormulaContext.getRuntime().getOS();
    }
    if (typeText === 'USER') {
        const licensee = FormulaContext.getRuntime().getUser();
        if (!licensee) {
            FormulaContext.formatResults('@[Red]');
            return 'Unidentified';
        }
        return licensee;
    }
    throw FormulaError.BuiltIn.Value;
}
export function ISBLANK(value) {
    return value
        .map(() => false)
        .fillEmpty(true);
}
export function ISERR(value) {
    return value
        .map((scalar) => {
        return scalar instanceof FormulaError.Known && (!(scalar instanceof FormulaError.NA));
    })
        .fillEmpty(false);
}
export function ISERROR(value) {
    return value
        .map((scalar) => {
        return scalar instanceof FormulaError.Known;
    })
        .fillEmpty(false);
}
export function ISEVEN(number) {
    return number
        .map((value) => {
        if (typeof value !== 'number')
            return false;
        return Math.trunc(value) % 2 === 0;
    })
        .fillEmpty(false);
}
export function ISFORMULA(reference) {
    return reference.map((scalar, coords) => {
        return FormulaContext.getFormulaAt(coords.rowIndex, coords.colIndex) !== null;
    }).fillEmpty(false);
}
export function ISLOGICAL(value) {
    return value
        .map((scalar) => {
        return typeof scalar === 'boolean';
    })
        .fillEmpty(false);
}
export function ISNA(value) {
    return value
        .map((scalar) => {
        return scalar instanceof FormulaError.NA;
    })
        .fillEmpty(false);
}
export function ISNONTEXT(value) {
    return value
        .map((scalar) => {
        return typeof scalar !== 'string';
    })
        .fillEmpty(false);
}
export function ISNUMBER(value) {
    return value
        .map((scalar) => {
        return typeof scalar === 'number';
    })
        .fillEmpty(false);
}
export function ISODD(number) {
    return number
        .map((value) => {
        if (typeof value !== 'number')
            return false;
        return Math.trunc(value) % 2 !== 0;
    })
        .fillEmpty(false);
}
export function ISOMITTED(argument) {
    return argument === undefined;
}
export function ISREF(value) {
    return value?.isIReferenceRange ?? false;
}
export function ISTEXT(value) {
    return value
        .map((scalar) => {
        return typeof scalar === 'string';
    })
        .fillEmpty(false);
}
export function N(value) {
    const scalar = value.getValueAt(0, 0);
    const type = typeof scalar;
    if (type === 'number')
        return scalar;
    if (type === 'boolean')
        return Number(scalar);
    if (scalar instanceof FormulaError.Known)
        throw scalar;
    return 0;
}
export function NA() {
    return FormulaError.BuiltIn.NA;
}
export function SHEET(value) {
    const index = FormulaContext.getSheetIndex(value);
    if (index >= 0)
        return index + 1;
    return FormulaError.BuiltIn.NA;
}
export function SHEETS(reference) {
    if (!reference)
        return FormulaContext.getSheetCount();
    return 1;
}
export function TYPE(value) {
    if (value.getWidth() > 1 || value.getHeight() > 1)
        return 64;
    const scalar = value.getValueAt(0, 0);
    const type = typeof scalar;
    if (type === 'string')
        return 2;
    if (type === 'boolean')
        return 4;
    if (scalar instanceof FormulaError.Known)
        return 16;
    return 1;
}
