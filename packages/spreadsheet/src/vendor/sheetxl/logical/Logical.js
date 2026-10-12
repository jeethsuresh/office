// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { ScalarType, IRange, FormulaError } from '@sheetxl/primitives';
import { Types } from '../_utils/_Types';
import { FormulaHelpers } from '../_utils/_Helpers';
export function AND(...logical) {
    let hasCoercible = false;
    for (const range of logical) {
        for (const value of range.values({ type: ScalarType.Boolean, coerce: true })) {
            hasCoercible = true;
            if (!value)
                return false;
        }
    }
    return hasCoercible ? true : FormulaError.BuiltIn.Value;
}
export function BYCOL(array, fn) {
    return undefined;
}
export function BYROW(array, fn) {
    return undefined;
}
export function FALSE() {
    return false;
}
const _broadcastOptions = { mismatchFill: FormulaError.BuiltIn.NA };
const _booleanGetOptions = { type: ScalarType.Boolean, coerce: true };
export function IF(logicalTest, valueIfTrue, valueIfFalse) {
    if (logicalTest.size === 1) {
        const isTrue = logicalTest.getValueAt(0, 0, _booleanGetOptions);
        return (isTrue) ? valueIfTrue : (valueIfFalse ?? logicalTest.empty().replace([[false]]));
    }
    const width = logicalTest.getWidth();
    const height = logicalTest.getHeight();
    if (width === 1 || height === 1) {
        const orientationLogical = width === 1 ? IRange.Orientation.Column : IRange.Orientation.Row;
        const isColumn = height === 1;
        const lengthTrue = isColumn ? valueIfTrue.getHeight() : valueIfTrue.getWidth();
        const broadtcastIfTrue = (isColumn ? valueIfTrue.getWidth() : valueIfTrue.getHeight()) === 1;
        if (!valueIfFalse) {
            const isColumn = height === 1;
            const lengthTrue = isColumn ? valueIfTrue.getHeight() : valueIfTrue.getWidth();
            valueIfFalse = logicalTest.empty().fill(false, {
                colStart: 0,
                rowStart: 0,
                colEnd: (isColumn ? 1 : lengthTrue) - 1,
                rowEnd: (isColumn ? lengthTrue : 1) - 1,
            });
        }
        const lengthFalse = isColumn ? valueIfFalse.getHeight() : valueIfFalse.getWidth();
        const broadtcastIfFalse = (isColumn ? valueIfFalse.getWidth() : valueIfFalse.getHeight()) === 1;
        const lengthsMax = Math.max(lengthTrue, lengthFalse);
        const ifError = logicalTest.empty().fill(FormulaError.BuiltIn.Value, {
            colStart: 0,
            rowStart: 0,
            colEnd: (isColumn ? valueIfFalse.getWidth() : lengthsMax) - 1,
            rowEnd: (isColumn ? lengthsMax : valueIfFalse.getHeight()) - 1,
        });
        const nas = [];
        let retValue = logicalTest.empty();
        logicalTest.forEach((logical, coords) => {
            const isTrue = logical === true;
            let valuesIf = isTrue ? valueIfTrue : valueIfFalse;
            if (logical instanceof FormulaError.Known) {
                valuesIf = ifError;
            }
            let index = 0;
            if ((isTrue && !broadtcastIfTrue) || (!isTrue && !broadtcastIfFalse)) {
                index = isColumn ? coords.colIndex : coords.rowIndex;
            }
            const slideBounds = isColumn ? { colStart: index, colEnd: index } : { rowStart: index, rowEnd: index };
            valuesIf = valuesIf.slice(slideBounds);
            retValue = retValue.replace(valuesIf, coords);
            const length = isColumn ? valuesIf.getHeight() : valuesIf.getWidth();
            if (length < lengthsMax) {
                if (isColumn) {
                    slideBounds.rowStart = length;
                    slideBounds.rowEnd = lengthsMax - 1;
                }
                else {
                    slideBounds.colStart = length;
                    slideBounds.colEnd = lengthsMax - 1;
                }
                nas.push(slideBounds);
            }
        }, { orientation: orientationLogical, type: ScalarType.Boolean, coerce: true, includeEmpty: true });
        for (let i = 0; i < nas.length; i++) {
            retValue = retValue.fill(FormulaError.BuiltIn.NA, nas[i]);
        }
        return retValue;
    }
    const colEnd = width - 1;
    const rowEnd = height - 1;
    const callbackFn = (a, b, coords) => {
        let colIndex = coords.colIndex;
        let rowIndex = coords.rowIndex;
        if ((colIndex > colEnd || rowIndex > rowEnd)) {
            return FormulaError.BuiltIn.NA;
        }
        const isTrue = logicalTest.getValueAt(coords.rowIndex, coords.colIndex, _booleanGetOptions);
        return isTrue ? a : b;
    };
    let retValue = valueIfTrue.broadcast(valueIfFalse, callbackFn, _broadcastOptions);
    retValue = retValue.fillEmpty(FormulaError.BuiltIn.NA, Math.max(valueIfTrue.getWidth(), valueIfFalse.getWidth()), Math.max(valueIfTrue.getHeight(), valueIfFalse.getHeight()));
    return retValue;
}
export function IFERROR(value, valueIfError) {
    return value.broadcast(valueIfError, (valueA = null, valueB = null) => {
        return valueA instanceof FormulaError.Known ? valueB : valueA;
    }, {
        mismatchFill: null
    });
}
export function IFNA(value, valueIfError) {
    return value.broadcast(valueIfError, (valueA = null, valueB = null) => {
        return FormulaError.BuiltIn.NA.equals(valueA) ? valueB : valueA;
    }, {
        mismatchFill: null
    });
}
export function IFS(logicalTest, logicalTrue, ...rest) {
    if (rest && rest.length % 2 !== 0)
        throw new FormulaError.NA('IFS expects all arguments after position 0 to be in pairs.');
    const ranges = [logicalTest, logicalTrue, ...rest];
    for (let i = 0; i < ranges.length / 2; i++) {
        const logicalTest = FormulaHelpers.accept(ranges[i * 2], Types.BOOLEAN);
        const valueIfTrue = FormulaHelpers.accept(ranges[i * 2 + 1]);
        if (logicalTest)
            return valueIfTrue;
    }
    throw FormulaError.BuiltIn.NA;
}
export function LAMDA(...parameterOrCalculation) {
    return undefined;
}
export function LET(name, nameOrValue, calculationOrName, ...rest) {
    return undefined;
}
export function MAKEARRAY(rows, columns, fn) {
    return undefined;
}
export function MAP(array, ...lamdaOrArray) {
    return undefined;
}
export function NOT(logical) {
    return logical
        .map((value) => {
        if (typeof value === 'boolean')
            return !value;
        if (typeof value === 'number')
            return value === 0;
        return FormulaError.BuiltIn.Value;
    })
        .fillEmpty(true);
}
export function OR(...logical) {
    let hasCoercible = false;
    for (const range of logical) {
        for (const value of range.values({ type: ScalarType.Boolean, coerce: true })) {
            hasCoercible = true;
            if (value === true)
                return true;
        }
    }
    return hasCoercible ? false : FormulaError.BuiltIn.Value;
}
export function REDUCE(initialValue, array, fn) {
    return undefined;
}
export function SCAN(initialValue, array, fn) {
    return undefined;
}
export function SWITCH(expression, value, ...results) {
    return undefined;
}
export function TRUE() {
    return false;
}
export function XOR(...logical) {
    let hasCoercible = false;
    let trueCount = 0;
    for (const range of logical) {
        for (const value of range.values({ type: ScalarType.Boolean, coerce: true })) {
            hasCoercible = true;
            if (value === true)
                trueCount++;
        }
    }
    return hasCoercible ? (trueCount % 2 === 1) : FormulaError.BuiltIn.Value;
}
