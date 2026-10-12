// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import jStat from 'jstat';
import { ScalarType, FormulaError } from '@sheetxl/primitives';
import { AVERAGE, AVERAGEA } from './Statistical';
import { COMBIN } from '../mathTrig/Math';
function toEqualArray(knownYs, knownXs = null) {
    const ysLength = knownYs.size;
    const ys = new Array(ysLength);
    let xs = new Array(ysLength);
    let index = 0;
    if (knownXs) {
        if (knownXs.size !== ysLength)
            throw FormulaError.BuiltIn.Ref;
        for (const value of knownXs.values({ includeEmpty: true })) {
            if (!(typeof value === 'number'))
                throw FormulaError.BuiltIn.Value;
            xs[index++] = value;
        }
    }
    else {
        for (let i = 0; i < ysLength; i++) {
            xs[i] = i + 1;
        }
    }
    index = 0;
    for (const value of knownYs.values()) {
        if (!(typeof value === 'number'))
            throw FormulaError.BuiltIn.Value;
        ys[index++] = value;
    }
    return [ys, xs];
}
export function BETA_DIST(x, alpha, beta, cumulative, a = 0, b = 1) {
    if (alpha <= 0 || beta <= 0 || x < a || x > b || a === b)
        return Number.NaN;
    x = (x - a) / (b - a);
    return cumulative ? jStat.beta.cdf(x, alpha, beta) : jStat.beta.pdf(x, alpha, beta) / (b - a);
}
export function BETADIST(x, alpha, beta, cumulative, a = 0, b = 1) {
    return BETA_DIST(x, alpha, beta, true, a, b);
}
export function BETA_INV(probability, alpha, beta, a = 0, b = 1) {
    if (alpha <= 0 || beta <= 0 || probability <= 0 || probability > 1)
        return Number.NaN;
    return jStat.beta.inv(probability, alpha, beta) * (b - a) + a;
}
export function BETAINV(probability, alpha, beta, a = 0, b = 1) {
    return BETA_INV(probability, alpha, beta, a, b);
}
export function BINOM_DIST(numberS, trials, probabilityS, cumulative) {
    if (trials < 0 || probabilityS < 0 || probabilityS > 1 || numberS < 0 || numberS > trials)
        return Number.NaN;
    return cumulative
        ? jStat.binomial.cdf(numberS, trials, probabilityS)
        : jStat.binomial.pdf(numberS, trials, probabilityS);
}
export function BINOMDIST(numberS, trials, probabilityS, cumulative) {
    return BINOM_DIST(numberS, trials, probabilityS, cumulative);
}
export function BINOM_DIST_RANGE(trials, probabilityS, numberS, numberS2 = numberS) {
    if (trials < 0 || probabilityS < 0 || probabilityS > 1 || numberS < 0 || numberS > trials || numberS2 < numberS || numberS2 > trials)
        return Number.NaN;
    let result = 0;
    for (let i = numberS; i <= numberS2; i++) {
        result += COMBIN(trials, i) * Math.pow(probabilityS, i) * Math.pow(1 - probabilityS, trials - i);
    }
    return result;
}
export function BINOM_INV(trials, probabilityS, alpha) {
    if (trials < 0 || probabilityS < 0 || probabilityS > 1 || alpha < 0 || alpha > 1)
        return Number.NaN;
    let x = 0;
    while (x <= trials) {
        if (jStat.binomial.cdf(x, trials, probabilityS) >= alpha) {
            return x;
        }
        x++;
    }
}
export function CHISQ_DIST(x, degFreedom, cumulative = false) {
    if (x < 0 || degFreedom < 1 || degFreedom > 10 ** 10)
        return Number.NaN;
    return cumulative
        ? jStat.chisquare.cdf(x, degFreedom)
        : jStat.chisquare.pdf(x, degFreedom);
}
export function CHIDIST(x, degFreedom) {
    return CHISQ_DIST(x, degFreedom);
}
export function CHISQ_DIST_RT(x, degFreedom) {
    degFreedom = Math.trunc(degFreedom);
    if (x < 0 || degFreedom < 1 || degFreedom > 10 ** 10)
        return Number.NaN;
    return 1 - jStat.chisquare.cdf(x, degFreedom);
}
export function CHISQ_INV(probability, degFreedom) {
    degFreedom = Math.trunc(degFreedom);
    if (probability < 0 || probability > 1 || degFreedom < 1 || degFreedom > 10 ** 10)
        return Number.NaN;
    return jStat.chisquare.inv(probability, degFreedom);
}
export function CHIINV(probability, degFreedom) {
    return CHISQ_INV(probability, degFreedom);
}
export function CHISQ_INV_RT(probability, degFreedom) {
    degFreedom = Math.trunc(degFreedom);
    if (probability < 0 || probability > 1 || degFreedom < 1 || degFreedom > 10 ** 10)
        return Number.NaN;
    return jStat.chisquare.inv(1 - probability, degFreedom);
}
export function CHISQ_TEST(actualRange, expectedRange) {
    if (actualRange.length !== expectedRange.length
        || actualRange[0].length !== expectedRange[0].length
        || actualRange.length === 1 && actualRange[0].length === 1)
        throw FormulaError.BuiltIn.NA;
    const row = actualRange.length;
    const col = actualRange[0].length;
    let dof = (row - 1) * (col - 1);
    if (row === 1)
        dof = col - 1;
    else
        dof = row - 1;
    let xsqr = 0;
    for (let i = 0; i < row; i++) {
        for (let j = 0; j < col; j++) {
            if (typeof actualRange[i][j] !== "number" || typeof expectedRange[i][j] !== "number")
                continue;
            if (expectedRange[i][j] === 0)
                return Infinity;
            xsqr += Math.pow((actualRange[i][j] - expectedRange[i][j]), 2) / expectedRange[i][j];
        }
    }
    let p = Math.exp(-0.5 * xsqr);
    if ((dof % 2) === 1) {
        p = p * Math.sqrt(2 * xsqr / Math.PI);
    }
    let k = dof;
    while (k >= 2) {
        p = p * xsqr / k;
        k = k - 2;
    }
    let t = p, a = dof;
    while (t > 0.000000000000001 * p) {
        a = a + 2;
        t = t * xsqr / a;
        p = p + t;
    }
    return 1 - p;
}
export function CHITEST(actualRange, expectedRange) {
    return CHISQ_TEST(actualRange, expectedRange);
}
export function CONFIDENCE_NORM(alpha, standardDev, size) {
    size = Math.trunc(size);
    if (alpha <= 0 || alpha >= 1 || standardDev <= 0 || size < 1)
        return Number.NaN;
    return jStat.normalci(1, alpha, standardDev, size)[1] - 1;
}
export function CONFIDENCE(alpha, std, dev, size) {
    size = Math.trunc(size);
    if (alpha <= 0 || alpha >= 1 || std <= 0 || size < 1)
        return Number.NaN;
    return jStat.normalci(dev, alpha, std, size)[1] - 1;
}
export function CONFIDENCE_T(alpha, standardDev, size) {
    size = Math.trunc(size);
    if (alpha <= 0 || alpha >= 1 || standardDev <= 0 || size < 1)
        return Number.NaN;
    if (size === 1)
        Infinity;
    return jStat.tci(1, alpha, standardDev, size)[1] - 1;
}
export function CORREL(array1, array2) {
    if (array1.length !== array2.length)
        throw FormulaError.BuiltIn.NA;
    const filterArr1 = [];
    const filterArr2 = [];
    for (let i = 0; i < array1.length; i++) {
        if (typeof array1[i] !== "number" || typeof array2[i] !== "number")
            continue;
        filterArr1.push(array1[i]);
        filterArr2.push(array2[i]);
    }
    if (filterArr1.length <= 1)
        return Infinity;
    return jStat.corrcoeff(filterArr1, filterArr2);
}
export function COVARIANCE_P(array1, array2) {
    if (array1.length !== array2.length)
        throw FormulaError.BuiltIn.NA;
    const filterArr1 = [];
    const filterArr2 = [];
    for (let i = 0; i < array1.length; i++) {
        if (typeof array1[i] !== "number" || typeof array2[i] !== "number")
            continue;
        filterArr1.push(array1[i]);
        filterArr2.push(array2[i]);
    }
    const mean1 = jStat.mean(filterArr1), mean2 = jStat.mean(filterArr2);
    let result = 0;
    for (let i = 0; i < filterArr1.length; i++) {
        result += (filterArr1[i] - mean1) * (filterArr2[i] - mean2);
    }
    return result / filterArr1.length;
}
export function COVARIANCE(array1, array2) {
    return COVARIANCE_P(array1, array2);
}
export function COVARIANCE_S(array1, array2) {
    if (array1.length !== array2.length)
        throw FormulaError.BuiltIn.NA;
    const filterArr1 = [];
    const filterArr2 = [];
    for (let i = 0; i < array1.length; i++) {
        if (typeof array1[i] !== "number" || typeof array2[i] !== "number")
            continue;
        filterArr1.push(array1[i]);
        filterArr2.push(array2[i]);
    }
    if (filterArr1.length <= 1)
        return Infinity;
    return jStat.covariance(filterArr1, filterArr2);
}
export function CRITBINOM(trails, probabilityS, alpha) {
    return undefined;
}
export function DEVSQ(...number) {
    let sum = 0;
    let numbers = [];
    for (const range of number) {
        for (const value of range.values()) {
            sum += value;
            numbers.push(value);
        }
    }
    const n = numbers.length;
    const mean = sum / n;
    sum = 0;
    for (let i = 0; i < n; i++) {
        sum += (numbers[i] - mean) ** 2;
    }
    return sum;
}
export function EXPON_DIST(x, lambda, cumulative) {
    if (x < 0 || lambda <= 0)
        return Number.NaN;
    return cumulative ? jStat.exponential.cdf(x, lambda) : jStat.exponential.pdf(x, lambda);
}
export function EXPONDIST(x, lambda, cumulative) {
    return EXPON_DIST(x, lambda, cumulative);
}
export function F_DIST(x, degFreedom1, degFreedom2, cumulative) {
    if (x < 0 || degFreedom1 < 1 || degFreedom2 < 1)
        return Number.NaN;
    degFreedom1 = Math.trunc(degFreedom1);
    degFreedom2 = Math.trunc(degFreedom2);
    return cumulative ? jStat.centralF.cdf(x, degFreedom1, degFreedom2) : jStat.centralF.pdf(x, degFreedom1, degFreedom2);
}
export function FDIST(x, degFreedom1, degFreedom2) {
    return F_DIST(x, degFreedom1, degFreedom2, true);
}
export function F_DIST_RT(x, degFreedom1, degFreedom2) {
    if (x < 0 || degFreedom1 < 1 || degFreedom2 < 1)
        return Number.NaN;
    degFreedom1 = Math.trunc(degFreedom1);
    degFreedom2 = Math.trunc(degFreedom2);
    return 1 - jStat.centralF.cdf(x, degFreedom1, degFreedom2);
}
export function F_INV(probability, degFreedom1, degFreedom2) {
    if (probability < 0.0 || probability > 1.0)
        return Number.NaN;
    if (degFreedom1 < 1.0 || degFreedom2 < 1.0)
        return Number.NaN;
    degFreedom1 = Math.trunc(degFreedom1);
    degFreedom2 = Math.trunc(degFreedom2);
    return jStat.centralF.inv(probability, degFreedom1, degFreedom2);
}
export function FINV(probability, degFreedom1, degFreedom2) {
    return F_INV(probability, degFreedom1, degFreedom2);
}
export function F_INV_RT(probability, degFreedom1, degFreedom2) {
    if (probability < 0.0 || probability > 1.0)
        return Number.NaN;
    if (degFreedom1 < 1.0 || degFreedom1 >= Math.pow(10, 10))
        return Number.NaN;
    if (degFreedom2 < 1.0 || degFreedom2 >= Math.pow(10, 10))
        return Number.NaN;
    degFreedom1 = Math.trunc(degFreedom1);
    degFreedom2 = Math.trunc(degFreedom2);
    return jStat.centralF.inv(1.0 - probability, degFreedom1, degFreedom2);
}
export function F_TEST(array1, array2) {
    const x1 = [];
    const x2 = [];
    let x1Mean = 0;
    let x2Mean = 0;
    for (let i = 0; i < Math.max(array1.length, array2.length); i++) {
        if (typeof array1[i] === "number") {
            x1.push(array1[i]);
            x1Mean += array1[i];
        }
        if (typeof array2[i] === "number") {
            x2.push(array2[i]);
            x2Mean += array2[i];
        }
    }
    if (x1.length <= 1 || x2.length <= 1)
        return Infinity;
    x1Mean /= x1.length;
    x2Mean /= x2.length;
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < x1.length; i++) {
        s1 += (x1Mean - x1[i]) ** 2;
    }
    s1 /= x1.length - 1;
    for (let i = 0; i < x2.length; i++) {
        s2 += (x2Mean - x2[i]) ** 2;
    }
    s2 /= x2.length - 1;
    return jStat.centralF.cdf(s1 / s2, x1.length - 1, x2.length - 1) * 2;
}
export function FTEST(array1, array2) {
    return F_TEST(array1, array2);
}
export function FISHER(x) {
    if (x <= -1 || x >= 1)
        return Number.NaN;
    return Math.log((1 + x) / (1 - x)) / 2;
}
export function FISHERINV(y) {
    const e2y = Math.exp(2 * y);
    return (e2y - 1) / (e2y + 1);
}
export function FORECAST(x, knownYs = null, knownXs = null) {
    const knownYsLength = knownYs.length;
    if (knownXs.length !== knownYsLength)
        throw FormulaError.BuiltIn.NA;
    const filteredY = [];
    const filteredX = [];
    let xAllEqual = true;
    for (let i = 0; i < knownYsLength; i++) {
        if (typeof knownYs[i] !== "number" || typeof knownXs[i] !== "number")
            continue;
        filteredY.push(knownYs[i]);
        filteredX.push(knownXs[i]);
        if (knownXs[i] !== knownXs[0])
            xAllEqual = false;
    }
    if (xAllEqual)
        return Infinity;
    const yMean = jStat.mean(filteredY);
    const xMean = jStat.mean(filteredX);
    let numerator = 0, denominator = 0;
    const filteredYLength = filteredY.length;
    for (let i = 0; i < filteredYLength; i++) {
        numerator += (filteredX[i] - xMean) * (filteredY[i] - yMean);
        denominator += (filteredX[i] - xMean) ** 2;
    }
    const b = numerator / denominator;
    const a = yMean - b * xMean;
    return a + b * x;
}
export function FORECAST_ETS(targetDate, values, timeline, seasonality = 0.95, dataCompletion = 1, aggregation = 1) {
    return undefined;
}
export function FORECAST_ETS_CONFINT(targetDate, values, timeline, confiedenceLevel = 0.95, seasonality = 0.95, dataCompletion = 1, aggregation = 1) {
    return undefined;
}
export function FORECAST_ETS_SEASONALITY(values, timeline, dataCompletion = 1, aggregation = 1) {
    return undefined;
}
export function FORECAST_ETS_STAT(values, timeline, statisticType, seasonality = 1, dataCompletion = 1, aggregation = 1) {
    return undefined;
}
export function FORECAST_LINEAR(x, knownYs, knownXs = null) {
    return FORECAST(x, knownYs, knownXs);
}
function flatten2D(array2D, defaultValue = undefined) {
    let retValue = [];
    for (let i = 0; i < array2D.length; i++) {
        const row = array2D[i];
        for (let j = 0; j < row.length; j++) {
            let value = row[j];
            if (value === undefined || value === null) {
                value = defaultValue;
            }
            retValue.push(value);
        }
    }
    return retValue;
}
export function FREQUENCY(dataArray, binsArray) {
    let dataArrayFlattened = flatten2D(dataArray);
    let binsArrayFlattened = flatten2D(binsArray);
    const binsArrayFiltered = [];
    for (let i = 0; i < binsArrayFlattened.length; i++) {
        if (typeof binsArrayFlattened[i] !== "number")
            continue;
        binsArrayFiltered.push(binsArrayFlattened[i]);
    }
    binsArrayFiltered.sort();
    binsArrayFiltered.push(Infinity);
    const result = [];
    for (let j = 0; j < binsArrayFiltered.length; j++) {
        result[j] = [];
        result[j][0] = 0;
        for (let i = 0; i < dataArrayFlattened.length; i++) {
            if (typeof dataArrayFlattened[i] !== "number") {
                continue;
            }
            const curr = dataArrayFlattened[i];
            if (curr <= binsArrayFiltered[j]) {
                result[j][0]++;
                dataArrayFlattened[i] = null;
            }
        }
    }
    return result;
}
export function GAMMA(x) {
    if (x === 0 || (x < 0 && x === Math.trunc(x)))
        return Number.NaN;
    return jStat.gammafn(x);
}
export function GAMMA_DIST(x, alpha, beta, cumulative = false) {
    if (x < 0 || alpha <= 0 || beta <= 0)
        return Number.NaN;
    return cumulative
        ? jStat.gamma.cdf(x, alpha, beta, true)
        : jStat.gamma.pdf(x, alpha, beta, false);
}
export function GAMMA_INV(probability, alpha, beta) {
    if (probability < 0 || probability > 1 || alpha <= 0 || beta <= 0)
        return Number.NaN;
    return jStat.gamma.inv(probability, alpha, beta);
}
export function GAMMALN(x) {
    if (x <= 0)
        return Number.NaN;
    return jStat.gammaln(x);
}
export function GAMMALN_PRECISE(x) {
    if (x <= 0)
        return Number.NaN;
    return jStat.gammaln(x);
}
export function GAUSS(x) {
    return jStat.normal.cdf(x, 0, 1) - 0.5;
}
export function GEOMEAN(...number) {
    const numbers = [];
    for (const range of number) {
        for (const value of range.values()) {
            numbers.push(value);
        }
    }
    return jStat.geomean(numbers);
}
export function GROWTH(knownYs, knownXs = null, newXs = null, useConst = true) {
    const knownYsLength = knownYs.length;
    for (let i = 0; i < knownYsLength; i++) {
        if (typeof knownYs[i] !== "number")
            throw FormulaError.BuiltIn.Value;
    }
    const isKnownXOmitted = knownXs === null;
    if (knownXs === null) {
        knownXs = [];
        for (let i = 1; i <= knownYsLength; i++) {
            knownXs.push(i);
        }
    }
    else {
        const knownXsLength = knownXs.length;
        if (knownXsLength !== knownYsLength)
            throw FormulaError.BuiltIn.Ref;
        for (let i = 0; i < knownXsLength; i++) {
            if (typeof knownXs[i] !== "number")
                throw FormulaError.BuiltIn.Value;
        }
    }
    if (newXs === null && isKnownXOmitted) {
        newXs = [];
        for (let i = 1; i <= knownYsLength; i++) {
            newXs.push(i);
        }
        newXs = [newXs];
    }
    else if (newXs === null) {
        newXs = Array.isArray(knownXs[0]) ? knownXs : [knownXs];
    }
    let avg_x = 0;
    let avg_y = 0;
    let avg_xy = 0;
    let avg_xx = 0;
    for (let i = 0; i < knownYsLength; i++) {
        const x = knownXs[i];
        const y = Math.log(knownYs[i]);
        avg_x += x;
        avg_y += y;
        avg_xy += x * y;
        avg_xx += x * x;
    }
    avg_x /= knownYsLength;
    avg_y /= knownYsLength;
    avg_xy /= knownYsLength;
    avg_xx /= knownYsLength;
    let beta;
    let alpha;
    if (useConst) {
        beta = (avg_xy - avg_x * avg_y) / (avg_xx - avg_x * avg_x);
        alpha = avg_y - beta * avg_x;
    }
    else {
        beta = avg_xy / avg_xx;
        alpha = 0;
    }
    const new_y = [];
    const newXsLength = newXs.length;
    for (let i = 0; i < newXsLength; i++) {
        new_y[i] = [];
        for (let j = 0; j < newXs[0].length; j++) {
            if (typeof newXs[i][j] !== "number")
                throw FormulaError.BuiltIn.Value;
            new_y[i][j] = Math.exp(alpha + beta * newXs[i][j]);
        }
    }
    return new_y;
}
export function HARMEAN(...number) {
    let cnt = 0;
    let denominator = 0;
    for (const range of number) {
        for (const value of range.values()) {
            denominator += 1 / value;
            cnt++;
        }
    }
    return cnt / denominator;
}
export function HYPGEOM_DIST(sampleS, numberSample, populationS, numberPop, cumulative) {
    sampleS = Math.trunc(sampleS);
    numberSample = Math.trunc(numberSample);
    populationS = Math.trunc(populationS);
    numberPop = Math.trunc(numberPop);
    if (numberPop <= 0 || sampleS < 0 || numberSample <= 0 || populationS <= 0)
        return Number.NaN;
    if (numberSample > numberPop)
        return Number.NaN;
    if (populationS > numberPop)
        return Number.NaN;
    if (numberSample < sampleS || populationS < sampleS)
        return Number.NaN;
    if (sampleS < (numberSample - numberPop + populationS))
        return Number.NaN;
    function pdf(x, n, M, N) {
        return COMBIN(M, x) * COMBIN(N - M, n - x) / COMBIN(N, n);
    }
    function cdf(x, n, M, N) {
        let result = 0;
        for (let i = 0; i <= x; i++) {
            result += pdf(i, n, M, N);
        }
        return result;
    }
    return cumulative
        ? cdf(sampleS, numberSample, populationS, numberPop)
        : pdf(sampleS, numberSample, populationS, numberPop);
}
export function INTERCEPT(knownYs, knownXs) {
    if (knownXs.length !== knownYs.length)
        throw FormulaError.BuiltIn.NA;
    const filteredY = [];
    const filteredX = [];
    for (let i = 0; i < knownYs.length; i++) {
        if (typeof knownYs[i] !== "number" || typeof knownXs[i] !== "number")
            continue;
        filteredY.push(knownYs[i]);
        filteredX.push(knownXs[i]);
    }
    if (filteredY.length <= 1)
        return Infinity;
    const yMean = jStat.mean(filteredY);
    const xMean = jStat.mean(filteredX);
    let numerator = 0, denominator = 0;
    for (let i = 0; i < filteredY.length; i++) {
        numerator += (filteredX[i] - xMean) * (filteredY[i] - yMean);
        denominator += (filteredX[i] - xMean) ** 2;
    }
    const b = numerator / denominator;
    return yMean - b * xMean;
}
export function KURT(...number) {
    let mean = 0;
    const numbers = [];
    for (const range of number) {
        for (const value of range.values()) {
            mean += value;
            numbers.push(value);
        }
    }
    const n = numbers.length;
    mean /= n;
    let sigma = 0;
    for (let i = 0; i < n; i++) {
        sigma += Math.pow(numbers[i] - mean, 4);
    }
    sigma = sigma / Math.pow(jStat.stdev(numbers, true), 4);
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sigma - 3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3));
}
export function LINEST(knownYs, knownXs = null, constant = true, stats = false) {
    const ysLength = knownYs.size;
    const [ys, xs] = toEqualArray(knownYs, knownXs);
    const ymean = jStat.mean(ys);
    const xmean = jStat.mean(xs);
    let num = 0;
    let den = 0;
    for (let i = 0; i < ysLength; i++) {
        num += (xs[i] - xmean) * (ys[i] - ymean);
        den += Math.pow(xs[i] - xmean, 2);
    }
    const m = num / den;
    const b = ymean - m * xmean;
    return [m, b];
}
export function LOGEST(knownYs, knownXs = null, constant = true, stats = false) {
    return undefined;
}
export function LOGNORM_DIST(x, mean, standardDev, cumulative) {
    if (x <= 0 || standardDev <= 0)
        return Number.NaN;
    return cumulative ? jStat.lognormal.cdf(x, mean, standardDev) : jStat.lognormal.pdf(x, mean, standardDev);
}
export function LOGNORM_INV(probability, mean, standardDev) {
    if (probability <= 0 || probability >= 1)
        return Number.NaN;
    if (standardDev <= 0)
        return Number.NaN;
    return jStat.lognormal.inv(probability, mean, standardDev);
}
export function MODE_MULT(...number) {
    return undefined;
}
export function MODE_SNGL(...number) {
    return undefined;
}
export function NEGBINOM_DIST(numberF, numberS, probabilityS, cumulative) {
    numberF = Math.trunc(numberF);
    numberS = Math.trunc(numberS);
    if (probabilityS < 0 || probabilityS > 1)
        return Number.NaN;
    if (numberF < 0 || numberS < 1)
        return Number.NaN;
    return cumulative
        ? jStat.negbin.cdf(numberF, numberS, probabilityS)
        : jStat.negbin.pdf(numberF, numberS, probabilityS);
}
export function NORM_DIST(x, mean, standardDev, cumulative) {
    if (standardDev <= 0)
        return Number.NaN;
    return cumulative
        ? jStat.normal.cdf(x, mean, standardDev)
        : jStat.normal.pdf(x, mean, standardDev);
}
export function NORM_INV(probability, mean, standardDev) {
    if (probability <= 0 || probability >= 1)
        return Number.NaN;
    if (standardDev <= 0)
        return Number.NaN;
    return jStat.normal.inv(probability, mean, standardDev);
}
export function NORM_S_DIST(z, cumulative) {
    return (cumulative)
        ? jStat.normal.cdf(z, 0, 1)
        : jStat.normal.pdf(z, 0, 1);
}
export function NORM_S_INV(probability) {
    if (probability <= 0 || probability >= 1)
        return Number.NaN;
    return jStat.normal.inv(probability, 0, 1);
}
export function PEARSON(array1, array2) {
    const a1Length = array1.size;
    const [a1, a2] = toEqualArray(array1, array2);
    const xmean = jStat.mean(a1);
    const ymean = jStat.mean(a2);
    let num = 0;
    let den1 = 0;
    let den2 = 0;
    for (let i = 0; i < a1Length; i++) {
        num += (a1[i] - xmean) * (a2[i] - ymean);
        den1 += Math.pow(a1[i] - xmean, 2);
        den2 += Math.pow(a2[i] - ymean, 2);
    }
    return num / Math.sqrt(den1 * den2);
}
export function PERCENTILE_EXC(array, k) {
    return undefined;
}
export function PERCENTILE_INC(array, k) {
    return undefined;
}
export function PERCENTRANK_EXC(array, x, significance = 3) {
    return undefined;
}
export function PERCENTRANK_INC(array, x, significance = 3) {
    return undefined;
}
const SQRT2PI = 2.5066282746310002;
export function PHI(x) {
    return Math.exp(-0.5 * x * x) / SQRT2PI;
}
export function POISSON_DIST(x, mean, cumulative) {
    if (x < 0 || mean < 0)
        return Number.NaN;
    x = Math.trunc(x);
    return cumulative
        ? jStat.poisson.cdf(x, mean)
        : jStat.poisson.pdf(x, mean);
}
export function PROB(xRange, probRange, lowerLimit, upperLimit) {
    return undefined;
}
export function QUARTILE_EXC(array, quart) {
    return undefined;
}
export function QUARTILE_INC(array, quart) {
    return undefined;
}
export function RANK_AVG(number, ref, order = 0) {
    return undefined;
}
export function RANK_EQ(number, ref, order = 0) {
    return undefined;
}
export function RSQ(knownYs, knownXs) {
    return undefined;
}
export function SKEW(...number) {
    return undefined;
}
export function SKEW_P(...number) {
    return undefined;
}
export function SLOPE(knownYs, knownXs) {
    const linear = LINEST(knownYs, knownXs);
    return linear[0];
}
export function STANDARDIZE(x, mean, standardDev) {
    if (standardDev <= 0)
        return Number.NaN;
    return (x - mean) / standardDev;
}
export function STDEV_P(...number) {
    return undefined;
}
export function STDEV_S(...number) {
    const v = VAR_S(...number);
    const result = Math.sqrt(v);
    return result;
}
export function STDEVA(...value) {
    return undefined;
}
export function STDEVPA(...value) {
    return undefined;
}
export function STEYX(knownYs, knownXs) {
    return undefined;
}
export function T_DIST(x, degFreedom, cumulative) {
    if (degFreedom < 1)
        return Number.NaN;
    return cumulative
        ? jStat.studentt.cdf(x, degFreedom)
        : jStat.studentt.pdf(x, degFreedom);
}
export function T_DIST_2T(x, degFreedom) {
    if (degFreedom < 1 || x < 0)
        return Number.NaN;
    return (1 - jStat.studentt.cdf(x, degFreedom)) * 2;
}
export function T_DIST_RT(x, degFreedom) {
    if (degFreedom < 1)
        return Number.NaN;
    return 1 - jStat.studentt.cdf(x, degFreedom);
}
export function T_INV(probability, degFreedom) {
    if (probability <= 0 || probability > 1 || degFreedom < 1)
        return Number.NaN;
    degFreedom = degFreedom % 1 === 0 ? degFreedom : Math.trunc(degFreedom);
    return jStat.studentt.inv(probability, degFreedom);
}
export function T_INV_2T(probability, degFreedom) {
    if (probability <= 0 || probability > 1 || degFreedom < 1)
        return Number.NaN;
    degFreedom = degFreedom % 1 === 0 ? degFreedom : Math.trunc(degFreedom);
    return Math.abs(jStat.studentt.inv(probability / 2, degFreedom));
}
export function T_TEST(array1, array2, tails, type) {
    return undefined;
}
export function TREND(knownYs, knownXs = null, newXs = null, consts = true) {
    return undefined;
}
export function TRIMMEAN(array, percent) {
    return undefined;
}
export function VAR_P(...number) {
    let sigma = 0;
    let count = 0;
    const mean = AVERAGE(...number);
    for (const range of number) {
        for (const value of range.values()) {
            sigma += Math.pow(value - mean, 2);
            count++;
        }
    }
    const result = sigma / count;
    if (isNaN(result)) {
        return FormulaError.BuiltIn.Num;
    }
    return result;
}
export function VAR_S(...number) {
    let sigma = 0;
    let count = 0;
    const mean = AVERAGE(...number);
    for (const range of number) {
        for (const value of range.values({ type: ScalarType.Number, includeMistyped: true })) {
            if (typeof value === 'number') {
                sigma += Math.pow(value - mean, 2);
            }
            count++;
        }
    }
    return sigma / (count - 1);
}
export function VARA(...value) {
    let sigma = 0;
    let count = 0;
    const mean = AVERAGEA(...value);
    for (const range of value) {
        for (const value of range.values()) {
            if (typeof value === 'number') {
                sigma += Math.pow(value - mean, 2);
            }
            else if (value === true) {
                sigma += Math.pow(1 - mean, 2);
            }
            else {
                sigma += Math.pow(0 - mean, 2);
            }
            count++;
        }
    }
    return sigma / (count - 1);
}
export function VARPA(...value) {
    const mean = AVERAGEA(...value);
    let sigma = 0;
    let cnt = 0;
    for (const range of value) {
        for (const v of range.values()) {
            cnt++;
            if (typeof v === 'number') {
                sigma += Math.pow(v - mean, 2);
            }
            else if (v === true) {
                sigma += Math.pow(1 - mean, 2);
            }
            else {
                sigma += Math.pow(0 - mean, 2);
            }
        }
    }
    return sigma / cnt;
}
export function WEIBULL_DIST(x, alpha, beta, cumulative) {
    if (x < 0 || alpha <= 0 || beta <= 0)
        return Number.NaN;
    return cumulative
        ? 1 - Math.exp(-Math.pow(x / beta, alpha))
        : Math.pow(x, alpha - 1) * Math.exp(-Math.pow(x / beta, alpha)) * alpha / Math.pow(beta, alpha);
}
export function Z_TEST(array, x, sigma = 0) {
    sigma = sigma || STDEV_S(array);
    const n = array.size;
    return 1 - NORM_S_DIST((AVERAGE(array) - x) / (sigma / Math.sqrt(n)), true);
}
