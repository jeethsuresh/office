// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaError } from '@sheetxl/primitives';
const numberRegex = /^\s?[+-]?\s?[0-9]+[.]?[0-9]*([eE][+-][0-9]+)?\s?$/;
const IMWithoutRealRegex = /^\s?([+-]?\s?([0-9]+[.]?[0-9]*([eE][+-][0-9]+)?)?)\s?[ij]\s?$/;
const IMRegex = /^\s?([+-]?\s?[0-9]+[.]?[0-9]*([eE][+-][0-9]+)?)\s?([+-]?\s?([0-9]+[.]?[0-9]*([eE][+-][0-9]+)?)?)\s?[ij]\s?$/;
const StandaloneWhitespaceRegEx = /^\s?[+-]?\s?$/;
function parseIM(textOrNumber) {
    let real = 0;
    let im = 0;
    let unit = 'i';
    if (typeof textOrNumber === 'number')
        return { real: textOrNumber, im, unit };
    if (typeof textOrNumber === 'boolean')
        throw FormulaError.BuiltIn.Value;
    let match = textOrNumber.match(numberRegex);
    if (match) {
        real = Number(match[0]);
        return { real, im, unit };
    }
    match = textOrNumber.match(IMWithoutRealRegex);
    if (match) {
        im = Number(StandaloneWhitespaceRegEx.test(match[1]) ? match[1] + '1' : match[1]);
        unit = match[0].slice(-1);
        return { real, im, unit };
    }
    match = textOrNumber.match(IMRegex);
    if (match) {
        real = Number(match[1]);
        im = Number(StandaloneWhitespaceRegEx.test(match[3]) ? match[3] + '1' : match[3]);
        unit = match[0].slice(-1);
        return { real, im, unit };
    }
    throw FormulaError.BuiltIn.Num;
}
export function COMPLEX(realNum, iNum, suffix = 'i') {
    if (suffix !== 'i' && suffix !== 'j') {
        throw FormulaError.BuiltIn.Value;
    }
    if (realNum === 0 && iNum === 0) {
        return 0;
    }
    if (realNum === 0) {
        if (iNum === 1) {
            return suffix;
        }
        if (iNum === -1) {
            return '-' + suffix;
        }
        return iNum.toString() + suffix;
    }
    if (iNum === 0) {
        return realNum.toString();
    }
    let sign = (iNum > 0) ? '+' : '';
    if (iNum === 1) {
        return realNum.toString() + sign + suffix;
    }
    if (iNum === -1) {
        return realNum.toString() + sign + '-' + suffix;
    }
    return realNum.toString() + sign + iNum.toString() + suffix;
}
export function IMABS(inumber) {
    const { real, im } = parseIM(inumber);
    return Math.sqrt(Math.pow(real, 2) + Math.pow(im, 2));
}
export function IMAGINARY(inumber) {
    return parseIM(inumber).im;
}
export function IMARGUMENT(inumber) {
    const { real, im } = parseIM(inumber);
    if (real === 0 && im === 0)
        return Infinity;
    if (real === 0 && im > 0) {
        return Math.PI / 2;
    }
    if (real === 0 && im < 0) {
        return -Math.PI / 2;
    }
    if (real < 0 && im === 0) {
        return Math.PI;
    }
    if (real > 0 && im === 0) {
        return 0;
    }
    if (real > 0) {
        return Math.atan(im / real);
    }
    if (real < 0 && im > 0) {
        return Math.atan(im / real) + Math.PI;
    }
    return Math.atan(im / real) - Math.PI;
}
export function IMCONJUGATE(inumber) {
    const { real, im, unit } = parseIM(inumber);
    return (im !== 0) ? COMPLEX(real, -im, unit) : '' + real;
}
export function IMCOS(inumber) {
    const { real, im, unit } = parseIM(inumber);
    const realInput = Math.cos(real) * (Math.exp(im) + Math.exp(-im)) / 2;
    const imaginaryInput = -Math.sin(real) * (Math.exp(im) - Math.exp(-im)) / 2;
    return COMPLEX(realInput, imaginaryInput, unit);
}
export function IMCOSH(inumber) {
    const { real, im, unit } = parseIM(inumber);
    const realInput = Math.cos(im) * (Math.exp(real) + Math.exp(-real)) / 2;
    const imaginaryInput = -Math.sin(im) * (Math.exp(real) - Math.exp(-real)) / 2;
    return COMPLEX(realInput, -imaginaryInput, unit);
}
export function IMCOT(inumber) {
    const real = IMCOS(inumber);
    const imaginary = IMSIN(inumber);
    return IMDIV(real, imaginary);
}
export function IMCSC(inumber) {
    return IMDIV('1', IMSIN(inumber));
}
export function IMCSCH(inumber) {
    return IMDIV('1', IMSINH(inumber));
}
export function IMDIV(inumber1, inumber2) {
    const res1 = parseIM(inumber1);
    const real1 = res1.real;
    const im1 = res1.im;
    const unit1 = res1.unit;
    const res2 = parseIM(inumber2);
    const real2 = res2.real;
    const im2 = res2.im;
    const unit2 = res2.unit;
    if (real2 === 0 && im2 === 0 || unit1 !== unit2)
        throw FormulaError.BuiltIn.Num;
    const unit = unit1;
    const denominator = Math.pow(real2, 2) + Math.pow(im2, 2);
    return COMPLEX((real1 * real2 + im1 * im2) / denominator, (im1 * real2 - real1 * im2) / denominator, unit);
}
export function IMEXP(inumber) {
    const { real, im, unit } = parseIM(inumber);
    const e = Math.exp(real);
    return COMPLEX(e * Math.cos(im), e * Math.sin(im), unit);
}
export function IMLN(inumber) {
    const { real, im, unit } = parseIM(inumber);
    return COMPLEX(Math.log(Math.sqrt(Math.pow(real, 2) + Math.pow(im, 2))), Math.atan(im / real), unit);
}
export function IMLOG10(inumber) {
    const { real, im, unit } = parseIM(inumber);
    const realInput = Math.log(Math.sqrt(Math.pow(real, 2) + Math.pow(im, 2))) / Math.log(10);
    const imaginaryInput = Math.atan(im / real) / Math.log(10);
    return COMPLEX(realInput, imaginaryInput, unit);
}
export function IMLOG2(inumber) {
    const { real, im, unit } = parseIM(inumber);
    const realInput = Math.log(Math.sqrt(Math.pow(real, 2) + Math.pow(im, 2))) / Math.log(2);
    const imaginaryInput = Math.atan(im / real) / Math.log(2);
    return COMPLEX(realInput, imaginaryInput, unit);
}
export function IMPOWER(inumber, number) {
    const { unit } = parseIM(inumber);
    const p = Math.pow(IMABS(inumber), number);
    const t = IMARGUMENT(inumber);
    const real = p * Math.cos(number * t);
    const imaginary = p * Math.sin(number * t);
    return COMPLEX(real, imaginary, unit);
}
export function IMPRODUCT(...inumber) {
    const inumberLength = inumber.length;
    if (inumberLength === 0)
        return 0;
    let result = inumber[0];
    parseIM(result);
    for (let i = 1; i < inumberLength; i++) {
        const item = inumber[i];
        const res1 = parseIM(result);
        const res2 = parseIM(item);
        const unit1 = res1.unit;
        const unit2 = res2.unit;
        if (unit1 !== unit2)
            throw FormulaError.BuiltIn.Value;
        const real1 = res1.real;
        const im1 = res1.im;
        const real2 = res2.real;
        const im2 = res2.im;
        result = COMPLEX(real1 * real2 - im1 * im2, real1 * im2 + im1 * real2);
    }
    return result;
}
export function IMREAL(inumber) {
    return parseIM(inumber).real;
}
export function IMSEC(inumber) {
    return IMDIV('1', IMCOS(inumber));
}
export function IMSECH(inumber) {
    return IMDIV('1', IMCOSH(inumber));
}
export function IMSIN(inumber) {
    const { real, im, unit } = parseIM(inumber);
    const realInput = Math.sin(real) * (Math.exp(im) + Math.exp(-im)) / 2;
    const imaginaryInput = Math.cos(real) * (Math.exp(im) - Math.exp(-im)) / 2;
    return COMPLEX(realInput, imaginaryInput, unit);
}
export function IMSINH(inumber) {
    const { real, im, unit } = parseIM(inumber);
    const realInput = Math.cos(im) * (Math.exp(real) - Math.exp(-real)) / 2;
    const imaginaryInput = Math.sin(im) * (Math.exp(real) + Math.exp(-real)) / 2;
    return COMPLEX(realInput, imaginaryInput, unit);
}
export function IMSQRT(inumber) {
    const { unit } = parseIM(inumber);
    const power = Math.sqrt(IMABS(inumber));
    const argument = IMARGUMENT(inumber);
    return COMPLEX(power * Math.cos(argument / 2), power * Math.sin(argument / 2), unit);
}
export function IMSUB(inumber1, inumber2) {
    const res1 = parseIM(inumber1);
    const real1 = res1.real;
    const im1 = res1.im;
    const unit1 = res1.unit;
    const res2 = parseIM(inumber2);
    const real2 = res2.real;
    const im2 = res2.im;
    const unit2 = res2.unit;
    if (unit1 !== unit2)
        throw FormulaError.BuiltIn.Value;
    return COMPLEX(real1 - real2, im1 - im2, unit1);
}
export function IMSUM(...inumber) {
    let realSum = 0;
    let imSum = 0;
    let prevUnit;
    const inumberLength = inumber.length;
    for (let i = 0; i < inumberLength; i++) {
        const item = inumber[i];
        const { real, im, unit } = parseIM(item);
        if (!prevUnit)
            prevUnit = unit;
        if (prevUnit !== unit)
            throw FormulaError.BuiltIn.Value;
        realSum += real;
        imSum += im;
    }
    return COMPLEX(realSum, imSum, prevUnit);
}
export function IMTAN(inumber) {
    return IMDIV(IMSIN(inumber), IMCOS(inumber));
}
