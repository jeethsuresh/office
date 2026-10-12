// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { IRange, FormulaError, FormulaContext } from '@sheetxl/primitives';
import { WildCard } from '../_utils';
export function ADDRESS(rowNum, columnNum, absNum = 1, a1 = true, sheetText = '') {
    if (rowNum < 1 || columnNum < 1 || absNum < 1 || absNum > 4)
        throw FormulaError.BuiltIn.Value;
    const asFixed = {
        $colIndex: absNum === 1 || absNum === 3,
        colIndex: columnNum - 1,
        $rowIndex: absNum === 1 || absNum === 2,
        rowIndex: rowNum - 1,
        sheetName: sheetText
    };
    return FormulaContext.getAddress(asFixed, !a1);
}
export function AREAS(...references) {
    return references.length;
}
export function CHOOSE(indexNum, value1, ...value) {
    if (indexNum === 1)
        return value1;
    if (indexNum < 1 || indexNum > value.length + 1)
        throw FormulaError.BuiltIn.Value;
    return value[indexNum - 2];
}
export function CHOOSECOLS(array, colNum1, ...colNum) {
    const asArray = array.getValues();
    const indices = [colNum1, ...colNum].map(index => {
        if (index <= 0) {
            throw FormulaError.BuiltIn.Value;
        }
        if (index > asArray[0].length) {
            throw FormulaError.BuiltIn.Ref;
        }
        return Math.floor(index - 1);
    });
    const result = [];
    for (let i = 0; i < asArray.length; i++) {
        result[i] = indices.map(colIdx => asArray[i][colIdx]);
    }
    return result;
}
export function CHOOSEROWS(array, rowNum1, ...rowNum) {
    const asArray = array.getValues();
    const indices = [rowNum1, ...rowNum].map(index => {
        if (index <= 0) {
            throw FormulaError.BuiltIn.Value;
        }
        if (index > asArray.length) {
            throw FormulaError.BuiltIn.Ref;
        }
        return Math.floor(index - 1);
    });
    return indices.map(rowIdx => [...asArray[rowIdx]]);
}
export function COLUMN(reference) {
    if (!reference) {
        return [FormulaContext.getPosition().colIndex + 1];
    }
    const retValue = [];
    const coords = reference.getCoords();
    const coordsColStart = coords.colStart;
    const coordsColEnd = coords.colEnd;
    for (let j = coordsColStart; j <= coordsColEnd; j++) {
        retValue.push(j + 1);
    }
    return retValue;
}
export function COLUMNS(array) {
    return array.getWidth();
}
export function DROP(array, row, columns = 0) {
    return undefined;
}
export function EXPAND(array, row, columns = 0, padWidth = FormulaError.BuiltIn.NA) {
    return undefined;
}
export function FIELDVALUE(value, fieldName) {
    return undefined;
}
export function FILTER(array, include, ifEmpty) {
    return undefined;
}
export function FORMULATEXT(reference) {
    const coords = reference.getCoords();
    const asText = FormulaContext.getFormulaAt(coords.rowStart, coords.colStart);
    if (asText === null) {
        throw FormulaError.BuiltIn.NA;
    }
    return '=' + asText;
}
export function GETPIVOTDATA(dataField, pivotTable, field1, item1) {
    return undefined;
}
export function GROUPBY(rowFields, values, fn, fieldHeaders = null, totalDepth = 2, sortOrder = null, filterArray = null, fieldRelationship = 0) {
    return undefined;
}
export function HLOOKUP(lookupValue, tableArray, rowIndexNum, rangeLookup = true) {
    if (rowIndexNum < 1)
        return FormulaError.BuiltIn.Value;
    if (rowIndexNum > tableArray.getHeight())
        return FormulaError.BuiltIn.Ref;
    if (tableArray.size === 1)
        return FormulaError.BuiltIn.NA;
    const asArray = tableArray.getValues();
    const lookupType = typeof lookupValue;
    const asString = typeof lookupValue === 'string' ? lookupValue : String(lookupValue);
    const isWildCard = WildCard.isWildCard(asString);
    const asWildCard = isWildCard ? WildCard.toRegex(asString, 'i') : null;
    if (rangeLookup) {
        let prevValue = lookupType === typeof asArray[0][0] ? asArray[0][0] : null;
        const asArray0Length = asArray[0].length;
        for (let i = 1; i < asArray0Length; i++) {
            const currValue = asArray[0][i];
            const type = typeof currValue;
            if (type !== lookupType)
                continue;
            if (prevValue > lookupValue && currValue > lookupValue) {
                throw FormulaError.BuiltIn.NA;
            }
            if (currValue === lookupValue)
                return asArray[rowIndexNum - 1][i];
            if (prevValue != null && currValue > lookupValue && prevValue <= lookupValue) {
                return asArray[rowIndexNum - 1][i - 1];
            }
            prevValue = currValue;
        }
        if (prevValue === null)
            throw FormulaError.BuiltIn.NA;
        if (asArray[0].length === 1) {
            return asArray[rowIndexNum - 1][0];
        }
        return prevValue;
    }
    else {
        let index = -1;
        if (isWildCard) {
            index = asArray[0].findIndex(item => {
                const asString = typeof item === 'string' ? item : String(item);
                return asWildCard.test(asString);
            });
        }
        else {
            index = asArray[0].findIndex(item => {
                return item === lookupValue;
            });
        }
        if (index === -1)
            throw FormulaError.BuiltIn.NA;
        return asArray[rowIndexNum - 1][index];
    }
}
export function HSTACK(array1, ...array) {
    return undefined;
}
export function HYPERLINK(linkLocation, friendlyName) {
    return undefined;
}
export function IMAGE(source, alternateText, sizing, height, width) {
    return undefined;
}
export function INDEX(array, rowNum = 0, colNum = 0, areaNum = 1) {
    if (rowNum < 0 || colNum < 0 || areaNum < 0)
        return FormulaError.BuiltIn.Value;
    if (areaNum > array.length)
        return FormulaError.BuiltIn.Ref;
    const asSingleRange = array[areaNum - 1];
    if (rowNum === 0 && colNum === 0)
        return asSingleRange;
    if (rowNum !== 0 && colNum !== 0)
        return asSingleRange.getValueAt(rowNum - 1, colNum - 1);
    const height = asSingleRange.getHeight();
    const width = asSingleRange.getWidth();
    if (rowNum > height || colNum > width)
        return FormulaError.BuiltIn.Ref;
    if (rowNum === 0) {
        const colIndex = colNum - 1;
        return asSingleRange.slice({
            colStart: colIndex,
            rowStart: 0,
            colEnd: colIndex,
            rowEnd: height - 1
        });
    }
    else {
        const rowIndex = rowNum - 1;
        return asSingleRange.slice({
            colStart: 0,
            rowStart: rowIndex,
            colEnd: width - 1,
            rowEnd: rowIndex
        });
    }
}
export function INDIRECT(refText, a1 = true) {
    return FormulaContext.getReference(refText, !a1);
}
export function LOOKUP(lookupValue, lookupVector, resultVector) {
    return undefined;
}
export function MATCH(lookupValue, lookupArray, matchType) {
    return undefined;
}
export function OFFSET(reference, rows, cols, height, width) {
    height = height ?? reference.getHeight();
    width = width ?? reference.getWidth();
    if (width < 0)
        throw FormulaError.BuiltIn.Ref;
    if (height < 0)
        throw FormulaError.BuiltIn.Ref;
    const refCoords = reference.getCoords();
    const offsetCoords = {
        rowStart: refCoords.rowStart + rows,
        colStart: refCoords.colStart + cols,
        rowEnd: refCoords.rowStart + rows + height - 1,
        colEnd: refCoords.colStart + cols + width - 1
    };
    return FormulaContext.getReference(offsetCoords);
}
export function PIVOTBY(rowFields, colFields, values, fn, fieldHeaders = null, rowTotalDepth = 2, rowSortOrder = null, colTotalDepth = 2, colSortOrder = null, filterArray = null, relativeTo = 0) {
    return undefined;
}
export function ROW(reference) {
    if (!reference) {
        return [FormulaContext.getPosition().rowIndex + 1];
    }
    const retValue = [];
    const coords = reference.getCoords();
    const coordsRowStart = coords.rowStart;
    const coordsRowEnd = coords.rowEnd;
    for (let j = coordsRowStart; j <= coordsRowEnd; j++) {
        retValue.push([j + 1]);
    }
    return retValue;
}
export function ROWS(array) {
    return array.getHeight();
}
export function RTD(progId, server, ...topic) {
    return undefined;
}
export function SORT(array, sortIndex, sortOrder, byCol = false) {
    return undefined;
}
export function SORTBY(array, byArray1, sortOrder) {
    return undefined;
}
export function TAKE(array, rows, columns = 0) {
    return undefined;
}
export function TOCOL(array, ignore = 0, scanByColumn = false) {
    return undefined;
}
export function TOROW(array, ignore = 0, scanByColumn = false) {
    return undefined;
}
export function TRANSPOSE(array) {
    return array.transpose();
}
export function TRIMRANGE(range, rowTrimMode = 3, colTrimMode = 3) {
    let rowStart = 0;
    let rowEnd = range.getHeight() - 1;
    let colStart = 0;
    let colEnd = range.getWidth() - 1;
    const isReference = range.isIReferenceRange;
    if (isReference) {
        const coords = range.getCoords();
        rowStart = coords.rowStart;
        rowEnd = coords.rowEnd;
        colStart = coords.colStart;
        colEnd = coords.colEnd;
    }
    else {
        rowStart = 0;
        rowEnd = range.getHeight() - 1;
        colStart = 0;
        colEnd = range.getWidth() - 1;
    }
    if (rowTrimMode === 1 || rowTrimMode === 3) {
        const start = range.entries({ orientation: IRange.Orientation.Row }).next().value;
        if (!start)
            return FormulaError.BuiltIn.Ref;
        rowStart = start.coords.rowIndex;
    }
    if (rowTrimMode === 2 || rowTrimMode === 3) {
        const end = range.entries({ reverse: true, orientation: IRange.Orientation.Row }).next().value;
        if (!end)
            return FormulaError.BuiltIn.Ref;
        rowEnd = end.coords.rowIndex;
    }
    if (colTrimMode === 1 || colTrimMode === 3) {
        const start = range.entries({ orientation: IRange.Orientation.Column }).next().value;
        if (!start)
            return FormulaError.BuiltIn.Ref;
        colStart = start.coords.colIndex;
    }
    if (colTrimMode === 2 || colTrimMode === 3) {
        const end = range.entries({ reverse: true, orientation: IRange.Orientation.Column }).next().value;
        if (!end)
            return FormulaError.BuiltIn.Ref;
        colEnd = end.coords.colIndex;
    }
    let retValue = undefined;
    if (isReference) {
        return FormulaContext.getReference({
            colStart,
            rowStart,
            colEnd,
            rowEnd
        });
    }
    else {
        retValue = range.slice({
            colStart,
            rowStart,
            rowEnd,
            colEnd
        });
    }
    return retValue;
}
export function UNIQUE(array, byCol = false, exactlyOnce = false) {
    return undefined;
}
export function VLOOKUP(lookupValue, tableArray, colIndexNum, rangeLookup = true) {
    if (colIndexNum < 1)
        return FormulaError.BuiltIn.Value;
    if (colIndexNum > tableArray.getWidth())
        return FormulaError.BuiltIn.Ref;
    if (tableArray.size === 1)
        return FormulaError.BuiltIn.NA;
    const asArray = tableArray.getValues();
    const lookupType = typeof lookupValue;
    const asString = typeof lookupValue === 'string' ? lookupValue : String(lookupValue);
    const isWildCard = WildCard.isWildCard(asString);
    const asWildCard = isWildCard ? WildCard.toRegex(asString, 'i') : null;
    if (rangeLookup) {
        let prevValue = lookupType === typeof asArray[0][0] ? asArray[0][0] : null;
        const asArrayLength = asArray.length;
        for (let i = 1; i < asArrayLength; i++) {
            const currRow = asArray[i];
            const currValue = asArray[i][0];
            const type = typeof currValue;
            if (type !== lookupType)
                continue;
            if (prevValue > lookupValue && currValue > lookupValue) {
                throw FormulaError.BuiltIn.NA;
            }
            if (currValue === lookupValue)
                return currRow[colIndexNum - 1];
            if (prevValue != null && currValue > lookupValue && prevValue <= lookupValue) {
                return asArray[i - 1][colIndexNum - 1];
            }
            prevValue = currValue;
        }
        if (prevValue === null)
            throw FormulaError.BuiltIn.NA;
        if (asArray.length === 1) {
            return asArray[0][colIndexNum - 1];
        }
        return prevValue;
    }
    else {
        let index = -1;
        if (isWildCard) {
            index = asArray.findIndex(currRow => {
                return asWildCard.test(currRow[0]);
            });
        }
        else {
            index = asArray.findIndex(currRow => {
                return currRow[0] === lookupValue;
            });
        }
        if (index === -1)
            throw FormulaError.BuiltIn.NA;
        return asArray[index][colIndexNum - 1];
    }
}
export function VSTACK(array1, ...array) {
    return undefined;
}
export function WRAPCOLS(vector, wrapCount, padWith = FormulaError.BuiltIn.NA) {
    return undefined;
}
export function WRAPROWS(vector, wrapCount, padWith = FormulaError.BuiltIn.NA) {
    return undefined;
}
export function XLOOKUP(lookupValue, lookupArray, returnArray, ifNotFound, rangeLookup = true, matchMode, searchMode = true) {
    return undefined;
}
export function XMATCH(lookupValue, lookupArray, matchMode, searchMode = true) {
    return undefined;
}
