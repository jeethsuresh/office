// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaError } from '@sheetxl/primitives';
import { Types } from './_Types';
class _FormulaHelpers {
    Types = Types;
    type2Number = {
        number: Types.NUMBER,
        boolean: Types.BOOLEAN,
        string: Types.STRING,
        object: -1
    };
    flattenDeep(arr1) {
        if (!Array.isArray(arr1)) {
            console.log('flattenDeep invalid arg', arr1);
            arr1 = [arr1];
        }
        return arr1.reduce((acc, val) => Array.isArray(val) ? acc.concat(this.flattenDeep(val)) : acc.concat(val), []);
    }
    acceptNumber(obj, isArray = true, allowBoolean = true) {
        if (obj instanceof FormulaError.Known)
            return obj;
        let asNumber;
        if (typeof obj === 'number') {
            asNumber = obj;
        }
        else if (typeof obj === 'boolean') {
            if (allowBoolean) {
                asNumber = Number(obj);
            }
            else {
                throw FormulaError.BuiltIn.Value;
            }
        }
        else if (typeof obj === 'string') {
            if (obj.length === 0) {
                throw FormulaError.BuiltIn.Value;
            }
            asNumber = Number(obj);
            if (asNumber !== asNumber) {
                throw FormulaError.BuiltIn.Value;
            }
        }
        else if (obj?.isIRange) {
            const asRange = obj;
            if (!isArray) {
                if (asRange.size === 1) {
                    asNumber = this.acceptNumber(asRange.getValueAt(0, 0) ?? 0);
                }
                else {
                    throw FormulaError.BuiltIn.Value;
                }
            }
            else {
                asNumber = this.acceptNumber(asRange.getValueAt(0, 0) ?? 0);
            }
        }
        else if (Array.isArray(obj)) {
            if (!isArray) {
                if (obj[0].length === 1) {
                    asNumber = this.acceptNumber(obj[0][0]);
                }
                else {
                    throw FormulaError.BuiltIn.Value;
                }
            }
            else {
                asNumber = this.acceptNumber(obj[0][0]);
            }
        }
        else {
            throw new FormulaError.Value('Unknown type in FormulaHelpers.acceptNumber');
        }
        return asNumber;
    }
    flattenParams(params, valueType, allowUnion, hook, defValue = null, minSize = 1) {
        if (params.length < minSize) {
            throw new FormulaError.NA(`Argument type ${valueType} is missing.`);
        }
        if (defValue == null) {
            defValue = valueType === Types.NUMBER ? 0 : valueType == null ? null : '';
        }
        params.forEach(param => {
            const { isCellRef, isRangeRef, isArray } = param;
            let value = param.value;
            const isUnion = false;
            const isLiteral = !isCellRef && !isRangeRef && !isArray && !isUnion;
            const info = { isLiteral, isCellRef, isRangeRef, isArray, isUnion };
            if (value?.isIRange) {
                value = value.getValues();
                if (isCellRef) {
                    value = value[0][0];
                }
            }
            if (isLiteral) {
                if (param.omitted)
                    param = defValue;
                else
                    param = this.accept(param, valueType, defValue);
                hook(param, info);
            }
            else if (isCellRef) {
                hook(value, info);
            }
            else if (isUnion) {
                if (!allowUnion)
                    throw FormulaError.BuiltIn.Value;
                param = param.value.data;
                param = this.flattenDeep(param);
                param.forEach(item => {
                    hook(item, info);
                });
            }
            else if (isRangeRef || isArray) {
                param = this.flattenDeep(value);
                param.forEach(item => {
                    hook(item, info);
                });
            }
        });
    }
    accept(param, type = null, defValue = undefined, flat = true, allowSingleValue = false) {
        let isArray = false;
        ;
        if (param && (param.isIRange || param.value?.isIRange)) {
            const asRange = (param.value ?? param);
            if (asRange.size === 1 || type !== Types.ARRAY) {
                param = asRange.getValueAt(0, 0);
            }
            else {
                param = asRange.getValueAt();
                isArray = true;
            }
        }
        else if (param?.value) {
            isArray = param.isArray;
            param = param.value;
        }
        if (Array.isArray(type))
            type = type[0];
        if (param === null || param === undefined) {
            if (defValue === undefined) {
                throw new FormulaError.NA(`Argument type ${type} is missing.`);
            }
            return defValue;
        }
        if (type === null || type === undefined)
            return param;
        if (param instanceof FormulaError.Known)
            throw param;
        if (type === Types.ARRAY) {
            if (Array.isArray(param)) {
                return flat ? this.flattenDeep(param) : param;
            }
            else if (Array.isArray(param.value)) {
                for (let i = 0; i < param.value.length; i++) {
                    const arrValue = param.value[i];
                    if (arrValue === null) {
                        param.value[i] = defValue;
                    }
                }
            }
            else if (allowSingleValue) {
                return flat ? [param] : [[param]];
            }
            else if (param.value === null) {
                return flat ? [defValue] : [[defValue]];
            }
            throw FormulaError.BuiltIn.Value;
        }
        if (isArray) {
            param = param[0][0];
        }
        const paramType = this.type(param);
        if (type === Types.STRING) {
            if (paramType === Types.BOOLEAN)
                param = param ? 'TRUE' : 'FALSE';
            else
                param = `${param}`;
        }
        else if (type === Types.BOOLEAN) {
            if (paramType === Types.STRING)
                throw FormulaError.BuiltIn.Value;
            if (paramType === Types.NUMBER)
                param = Boolean(param);
        }
        else if (type === Types.NUMBER) {
            param = this.acceptNumber(param, false);
        }
        else if (type === Types.NUMBER_NO_BOOLEAN) {
            param = this.acceptNumber(param, false, false);
        }
        else {
            throw FormulaError.BuiltIn.Value;
        }
        return param;
    }
    type(variable) {
        if (variable.isIRange) {
            return Types.RANGE_REF;
        }
        let type = this.type2Number[typeof variable];
        if (type === -1) {
            if (Array.isArray(variable))
                type = Types.ARRAY;
            else if (variable.ref) {
                if (variable.ref.from) {
                    type = Types.RANGE_REF;
                }
                else {
                    type = Types.CELL_REF;
                }
            }
        }
        return type;
    }
}
export const FormulaHelpers = new _FormulaHelpers();
