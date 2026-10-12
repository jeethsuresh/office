// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaError, FormulaContext } from '@sheetxl/primitives';
import { DAYS360, DATEDIF, DAYS, YEARFRAC } from '../dateTime/Date';
const epsMax = 1e-7;
const defaultCurrencyFormat = (runtime) => {
    const currency = runtime.getCurrencySymbol();
    const group = runtime.getNumberGroupSeparator();
    const decimal = runtime.getNumberDecimalSeparator();
    return `${currency}#${group}##0${decimal}00_);[Red](${currency}#${group}##0${decimal}00)`;
};
const isMoreThanOneYearAfter = (startDate, endDate) => {
    const yearDiff = endDate.getFullYear() - startDate.getFullYear();
    if (yearDiff > 1)
        return true;
    if (yearDiff < 1)
        return false;
    const monthDiff = endDate.getMonth() - startDate.getMonth();
    if (monthDiff > 0)
        return true;
    if (monthDiff < 0)
        return false;
    const dayDiff = endDate.getDate() - startDate.getDate();
    return dayDiff > 0;
};
function findLastCouponDate(settlementDate, maturityDate, frequency) {
    const result = new Date(maturityDate);
    result.setFullYear(settlementDate.getFullYear());
    if (result > settlementDate) {
        while (result > settlementDate) {
            result.setMonth(result.getMonth() - Math.round(12 / frequency));
        }
    }
    else {
        const nextDate = new Date(result);
        nextDate.setMonth(nextDate.getMonth() + Math.round(12 / frequency));
        while (nextDate <= settlementDate) {
            result.setTime(nextDate.getTime());
            nextDate.setMonth(nextDate.getMonth() + Math.round(12 / frequency));
        }
    }
    return result;
}
function validFrequency(frequency) {
    if (frequency < 1 || frequency > 4 || frequency === 3)
        return false;
    return true;
}
function validDate(oadate) {
    if (oadate < 0 || oadate >= 2958466)
        return false;
    return true;
}
function validBasis(basis) {
    if (basis < 0 || basis > 4) {
        return false;
    }
    return true;
}
export function ACCRINT(issue, firstInterest, settlement, rate, par, frequency, basis = 0, calcMethod = true) {
    if (!validDate(issue)
        || !validDate(firstInterest) || !validDate(settlement)
        || !validFrequency(frequency) || validBasis(basis)) {
        return Number.NaN;
    }
    if (rate <= 0 || par <= 0)
        Number.NaN;
    if (settlement <= issue)
        Number.NaN;
    return par * rate * YEARFRAC(issue, settlement, basis);
}
export function ACCRINTM(issue, settlement, rate, par, basis = 0) {
    if (!validDate(issue) || !validDate(settlement) || !validBasis(basis))
        Number.NaN;
    return undefined;
}
export function AMORLINC(cost, datePurchased, firstPeriod, salvarge, period, rate, basis = 0) {
    if (!validDate(datePurchased) || !validDate(firstPeriod) || !validBasis(basis))
        Number.NaN;
    return undefined;
}
export function COUPDAYBS(settlement, maturity, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis))
        Number.NaN;
    return undefined;
}
export function COUPDAYS(settlement, maturity, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis))
        Number.NaN;
    if (!validDate(settlement) || settlement >= maturity)
        Number.NaN;
    if (basis === 1) {
        const settlementDate = FormulaContext.fromOADate(settlement);
        const maturityDate = FormulaContext.fromOADate(maturity);
        const lastCouponDate = findLastCouponDate(settlementDate, maturityDate, frequency);
        const nextCouponDate = new Date(lastCouponDate);
        nextCouponDate.setMonth(nextCouponDate.getMonth() + Math.round(12 / frequency));
        return DATEDIF(FormulaContext.toOADate(lastCouponDate), FormulaContext.toOADate(nextCouponDate), 'D');
    }
    let daysInYear;
    switch (basis) {
        case 0:
        case 2:
        case 4:
            daysInYear = 360;
            break;
        case 3:
            daysInYear = 365;
            break;
        default:
            return Number.NaN;
    }
    return daysInYear / frequency;
}
export function COUPNCD(settlement, maturity, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis))
        Number.NaN;
    return undefined;
}
export function COUPNUM(settlement, maturity, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis))
        Number.NaN;
    return undefined;
}
export function COUPPCD(settlement, maturity, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis))
        Number.NaN;
    return undefined;
}
export function CUMIPMT(rate, nper, pv, startPeriod, endPeriod, type) {
    if (!validDate(startPeriod) || !validDate(endPeriod))
        return Number.NaN;
    if (rate <= 0 || nper <= 0 || pv <= 0)
        return Number.NaN;
    if (startPeriod < 1 || endPeriod < 1 || startPeriod > endPeriod)
        return Number.NaN;
    if (type !== 0 && type !== 1)
        return Number.NaN;
    const payment = PMT(rate, nper, pv, 0, type);
    let interest = 0;
    if (startPeriod === 1) {
        if (type === 0) {
            interest = -pv;
        }
        startPeriod++;
    }
    for (let i = startPeriod; i <= endPeriod; i++) {
        interest += type === 1 ? FV(rate, i - 2, payment, pv, 1) - payment : FV(rate, i - 1, payment, pv, 0);
    }
    interest *= rate;
    return interest;
}
export function CUMPRINC(rate, nper, pv, startPeriod, endPeriod, type) {
    if (!validDate(startPeriod) || !validDate(endPeriod))
        return Number.NaN;
    if (startPeriod > endPeriod)
        return Number.NaN;
    if (rate <= 0 || nper <= 0 || pv <= 0)
        return Number.NaN;
    if (startPeriod < 1 || endPeriod < 1 || startPeriod > endPeriod)
        return Number.NaN;
    if (type !== 0 && type !== 1)
        return Number.NaN;
    const payment = PMT(rate, nper, pv, 0, type);
    let principal = 0;
    if (startPeriod === 1) {
        principal = type === 0 ? payment + pv * rate : payment;
        startPeriod++;
    }
    for (let i = startPeriod; i <= endPeriod; i++) {
        principal +=
            type > 0
                ? payment - (FV(rate, i - 2, payment, pv, 1) - payment) * rate
                : payment - FV(rate, i - 1, payment, pv, 0) * rate;
    }
    return principal;
}
export function DB(cost, salvage, life, period, month = 12) {
    if (cost < 0 || salvage < 0 || life < 0 || period < 0)
        return Number.NaN;
    if (month < 1 || month > 12)
        return Number.NaN;
    if (period > life)
        return Number.NaN;
    if (salvage >= cost)
        return 0;
    const rateUnrounded = 1 - Math.pow(salvage / cost, 1 / life);
    const rate = Math.round(rateUnrounded * 1000) / 1000;
    FormulaContext.formatResults(defaultCurrencyFormat(FormulaContext.getRuntime()));
    if (period === 1) {
        return (cost * rate * month) / 12;
    }
    let totalDepreciation = (cost * rate * month) / 12;
    for (let i = 2; i <= period; i++) {
        if (i === period && period === life) {
            return Math.max(0, cost - totalDepreciation - salvage);
        }
        const currentDepreciation = (cost - totalDepreciation) * rate;
        if (i === period) {
            return currentDepreciation;
        }
        totalDepreciation += currentDepreciation;
    }
    return 0;
}
export function DDB(cost, salvage, life, period, factor = 2) {
    if (cost < 0 || salvage < 0 || life < 0 || period < 0 || factor <= 0)
        return Number.NaN;
    if (period > life)
        return Number.NaN;
    if (salvage >= cost)
        return 0;
    let total = 0;
    let current = 0;
    for (let i = 1; i <= period; i++) {
        current = Math.min((cost - total) * (factor / life), cost - salvage - total);
        total += current;
    }
    return current;
}
export function DISC(settlement, maturity, pr, redemption, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis))
        return Number.NaN;
    if (pr <= 0 || redemption <= 0)
        return Number.NaN;
    if (settlement >= maturity)
        throw FormulaError.BuiltIn.Value;
    let basisVal;
    let diff;
    switch (basis) {
        case 0:
            basisVal = 360;
            diff = DAYS360(settlement, maturity, false);
            break;
        case 1:
            basisVal = 365;
            diff = DATEDIF(settlement, maturity, 'D');
            break;
        case 2:
            basisVal = 360;
            diff = DATEDIF(settlement, maturity, 'D');
            break;
        case 3:
            basisVal = 365;
            diff = DATEDIF(settlement, maturity, 'D');
            break;
        case 4:
            basisVal = 360;
            diff = DAYS360(settlement, maturity, true);
            break;
        default:
            return Number.NaN;
    }
    return (((redemption - pr) / redemption) * basisVal) / diff;
}
export function DOLLARDE(fractionalDollar, fraction) {
    fraction = Math.trunc(fraction);
    if (fraction < 0)
        return Number.NaN;
    if (fraction < 1)
        return Infinity;
    let result = fractionalDollar;
    result += ((fractionalDollar % 1) * Math.pow(10, Math.ceil(Math.log(fraction) / Math.LN10))) / fraction;
    const power = Math.pow(10, Math.ceil(Math.log(fraction) / Math.LN2) + 1);
    result = Math.round(result * power) / power;
    return result;
}
export function DOLLARFR(decimalDollar, fraction) {
    fraction = Math.trunc(fraction);
    if (fraction < 0)
        return Number.NaN;
    if (fraction < 1)
        return Infinity;
    let result = decimalDollar;
    result += (decimalDollar % 1) * Math.pow(10, -Math.ceil(Math.log(fraction) / Math.LN10)) * fraction;
    return result;
}
export function DURATION(settlement, maturity, coupon, yld, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis))
        return Number.NaN;
    return undefined;
}
export function EFFECT(nominalRate, npery) {
    npery = Math.trunc(npery);
    return Math.pow(1 + nominalRate / npery, npery) - 1;
}
export function FV(rate, nper, pmt, pv = 0, type = 0) {
    let result;
    if (rate === 0) {
        result = pv + pmt * nper;
    }
    else {
        const term = Math.pow(1 + rate, nper);
        result =
            type === 1
                ? pv * term + (pmt * (1 + rate) * (term - 1)) / rate
                : pv * term + (pmt * (term - 1)) / rate;
    }
    FormulaContext.formatResults(defaultCurrencyFormat(FormulaContext.getRuntime()));
    return -result;
}
export function FVSCHEDULE(principal, schedule) {
    let acc = principal;
    for (const rate of schedule.values({ includeMistyped: true })) {
        if (typeof rate !== 'number')
            throw FormulaError.BuiltIn.Value;
        acc *= (1 + rate);
    }
    return acc;
}
export function INTRATE(settlement, maturity, investment, redemption, basis = 2) {
    if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis))
        return Number.NaN;
    if (investment <= 0 || redemption <= 0 || settlement >= maturity)
        return Number.NaN;
    if (investment >= redemption)
        return Infinity;
    if (isMoreThanOneYearAfter(FormulaContext.fromOADate(settlement), FormulaContext.fromOADate(maturity)))
        return Number.NaN;
    return undefined;
}
export function IPMT(rate, per, nper, pv, fv = 0, type = 0) {
    const pmt = PMT(rate, nper, pv, fv, type);
    if (per === 1) {
        return rate * (type ? 0 : -pv);
    }
    const ifv = type
        ? FV(rate, per - 2, pmt, pv, type) - pmt
        : FV(rate, per - 1, pmt, pv, type);
    return rate * ifv;
}
export function IRR(values, guess = 0.1) {
    return undefined;
}
export function ISPMT(rate, per, nper, pv) {
    if (nper === 0)
        return Infinity;
    return pv * rate * (per / nper - 1);
}
export function MDURATION(settlement, maturity, coupon, yld, frequency, basis = 2) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis))
        return Number.NaN;
    return undefined;
}
export function MIRR(values, financeRate, reinvestRate) {
    let hasPositive = false;
    let hasNegative = false;
    const posValues = [];
    const negValues = [];
    for (const value of values) {
        if (value > 0) {
            hasPositive = true;
            posValues.push(value);
            negValues.push(0);
        }
        else if (value < 0) {
            hasNegative = true;
            negValues.push(value);
            posValues.push(0);
        }
        else {
            negValues.push(0);
            posValues.push(0);
        }
    }
    if (!hasPositive || !hasNegative)
        return Infinity;
    const nom = NPV(reinvestRate, ...posValues);
    if (nom === Infinity)
        return nom;
    const denom = NPV(financeRate, ...negValues);
    if (denom === Infinity)
        return nom;
    const n = values.length;
    return Math.pow((-nom * Math.pow(1 + reinvestRate, n) / denom / (1 + financeRate)), 1 / (n - 1)) - 1;
}
export function NOMINAL(effectiveRate, npery) {
    npery = Math.trunc(npery);
    return (Math.pow(effectiveRate + 1, 1 / npery) - 1) * npery;
}
export function NPER(rate, pmt, pv, fv = 0, type = 0) {
    if (rate === 0) {
        if (pmt === 0) {
            return Infinity;
        }
        return (-pv - fv) / pmt;
    }
    if (type) {
        pmt *= 1 + rate;
    }
    return Math.log((pmt - fv * rate) / (pv * rate + pmt)) / Math.log(1 + rate);
}
export function NPV(rate, ...value) {
    if (value.length > 254) {
        throw FormulaError.BuiltIn.Value;
    }
    let acc = 0;
    const valueLength = value.length;
    for (let i = valueLength - 1; i >= 0; i--) {
        acc += value[i];
        if (rate === -1) {
            if (acc === 0) {
                continue;
            }
            return Infinity;
        }
        acc /= 1 + rate;
    }
    return acc;
}
export function ODDFPRICE(settlement, maturity, issue, firstCoupon, yld, redemption, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validDate(issue) || !validDate(firstCoupon) ||
        !validFrequency(frequency) || !validBasis(basis)) {
        return Number.NaN;
    }
    return undefined;
}
export function ODDFYIELD(settlement, maturity, issue, firstCoupon, yld, redemption, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validDate(issue) || !validDate(firstCoupon) ||
        !validFrequency(frequency) || !validBasis(basis)) {
        return Number.NaN;
    }
    return undefined;
}
export function ODDLPRICE(settlement, maturity, lastInterest, rate, yld, redemption, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validDate(lastInterest) ||
        !validFrequency(frequency) || !validBasis(basis)) {
        return Number.NaN;
    }
    return undefined;
}
export function ODDLYIELD(settlement, maturity, lastInterest, rate, pr, redemption, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validDate(lastInterest) ||
        !validFrequency(frequency) || !validBasis(basis)) {
        return Number.NaN;
    }
    return undefined;
}
export function PDURATION(rate, pv, fv) {
    return (Math.log(fv) - Math.log(pv)) / Math.log(1 + rate);
}
export function PMT(rate, nper, pv, fv = 0, type = 0) {
    if (rate === 0) {
        return (-pv - fv) / nper;
    }
    type = type ? 1 : 0;
    const term = Math.pow(1 + rate, nper);
    FormulaContext.formatResults(defaultCurrencyFormat(FormulaContext.getRuntime()));
    return (fv * rate + pv * rate * term) * (type ? 1 / (1 + rate) : 1) / (1 - term);
}
export function PRICE(settlement, maturity, rate, yld, redemption, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis))
        return Number.NaN;
    return undefined;
}
export function PRICEDISC(settlement, maturity, discount, redemption, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis))
        return Number.NaN;
    if (discount <= 0 || redemption <= 0)
        return Number.NaN;
    if (settlement >= maturity)
        throw FormulaError.BuiltIn.Value;
    let basisVal;
    let diff;
    switch (basis) {
        case 0:
            basisVal = 360;
            diff = DAYS360(settlement, maturity, false);
            break;
        case 1:
            basisVal = 365;
            diff = DATEDIF(settlement, maturity, 'D');
            break;
        case 2:
            basisVal = 360;
            diff = DATEDIF(settlement, maturity, 'D');
            break;
        case 3:
            basisVal = 365;
            diff = DATEDIF(settlement, maturity, 'D');
            break;
        case 4:
            basisVal = 360;
            diff = DAYS360(settlement, maturity, true);
            break;
        default:
            return Number.NaN;
    }
    return redemption - (discount * redemption * diff) / basisVal;
}
export function PRICEMAT(settlement, maturity, issue, rate, yld, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validDate(issue) || !validBasis(basis))
        return Number.NaN;
    return undefined;
}
export function PV(rate, nper, pmt, fv = 0, type = 0) {
    type = type ? 1 : 0;
    if (rate === -1) {
        if (nper === 0)
            return Number.NaN;
        return Infinity;
    }
    FormulaContext.formatResults(defaultCurrencyFormat(FormulaContext.getRuntime()));
    if (rate === 0) {
        return -pmt * nper - fv;
    }
    return ((1 - Math.pow(1 + rate, nper)) * pmt * (1 + rate * type) / rate - fv) / Math.pow(1 + rate, nper);
}
export function RATE(nper, pmt, pv, fv = 0, type = 0, guess = 0.1) {
    if (guess <= -1)
        throw FormulaError.BuiltIn.Value;
    type = type ? 1 : 0;
    const iterMax = 20;
    let rate = guess;
    if (rate === 0.1 && Math.abs(pmt) > Math.abs(pv) / 10) {
        rate = 0.2;
    }
    for (let i = 0; i < iterMax; i++) {
        if (rate <= -1)
            return Number.NaN;
        let y = 0;
        if (Math.abs(rate) < epsMax) {
            y = pv * (1 + nper * rate) + pmt * (1 + rate * type) * nper + fv;
        }
        else {
            const f = Math.pow(1 + rate, nper);
            y = pv * f + pmt * (1 / rate + type) * (f - 1) + fv;
        }
        if (Math.abs(y) < epsMax) {
            return rate;
        }
        let dy = 0;
        if (Math.abs(rate) < epsMax) {
            dy = pv * nper + pmt * type * nper;
        }
        else {
            const f = Math.pow(1 + rate, nper);
            const df = nper * Math.pow(1 + rate, nper - 1);
            dy = pv * df + pmt * (1 / rate + type) * df + pmt * (-1 / (rate * rate)) * (f - 1);
        }
        rate -= y / dy;
    }
    return Number.NaN;
}
export function RECEIVED(settlement, maturity, investment, discount, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis)) {
        return Number.NaN;
    }
    return undefined;
}
export function RRI(nper, pv, fv) {
    if (pv === 0 || (fv < 0 && pv > 0) || (fv > 0 && pv < 0))
        return Number.NaN;
    return Math.pow(fv / fv, 1 / nper) - 1;
}
export function SLN(cost, salvage, life) {
    if (life === 0)
        Infinity;
    return (cost - salvage) / life;
}
export function STOCKHISTORY(stock, startDate, endDate, interval = 0, headers = 1, properties = [0, 1, 2, 3, 4]) {
    if (!validDate(startDate) || !validDate(endDate)) {
        throw FormulaError.BuiltIn.Num;
    }
    return undefined;
}
export function SYD(cost, salvage, life, per) {
    if (per > life)
        return Number.NaN;
    return ((cost - salvage) * (life - per + 1) * 2) / (life * (life + 1));
}
export function TBILLEQ(settlement, maturity, discount) {
    if (!validDate(settlement) || !validDate(maturity))
        return Number.NaN;
    settlement = Math.round(settlement);
    maturity = Math.round(maturity);
    if (settlement >= maturity || isMoreThanOneYearAfter(FormulaContext.fromOADate(settlement), FormulaContext.fromOADate(maturity))) {
        return Number.NaN;
    }
    const denom = 360 - discount * (maturity - settlement);
    if (denom === 0)
        return 0;
    if (denom < 0)
        return Number.NaN;
    return 365 * discount / denom;
}
export function TBILLPRICE(settlement, maturity, discount) {
    if (!validDate(settlement) || !validDate(maturity))
        return Number.NaN;
    settlement = Math.round(settlement);
    maturity = Math.round(maturity);
    if (settlement >= maturity || isMoreThanOneYearAfter(FormulaContext.fromOADate(settlement), FormulaContext.fromOADate(maturity))) {
        return Number.NaN;
    }
    const denom = 360 - discount * (maturity - settlement);
    if (denom === 0)
        return 0;
    if (denom < 0)
        return Number.NaN;
    return 100 * (1 - discount * (maturity - settlement) / 360);
}
export function TBILLYIELD(settlement, maturity, pr) {
    if (!validDate(settlement) || !validDate(maturity))
        return Number.NaN;
    settlement = Math.round(settlement);
    maturity = Math.round(maturity);
    if (settlement >= maturity || isMoreThanOneYearAfter(FormulaContext.fromOADate(settlement), FormulaContext.fromOADate(maturity))) {
        return Number.NaN;
    }
    return (100 - pr) * 360 / (pr * (maturity - settlement));
}
export function VDB(cost, salvage, life, startPeriod, endPeriod, factor = 2, noSwitch = false) {
    if (!validDate(startPeriod) || !validDate(endPeriod))
        return Number.NaN;
    return undefined;
}
export function XIRR(values, dates, guess = 0.1) {
    return undefined;
}
export function XNPV(rate, values, dates) {
    let acc = 0;
    const valuesLength = values.length;
    for (let i = 0; i < valuesLength; i++) {
        acc += values[i] / Math.pow(1 + rate, DAYS(dates[i], dates[0]) / 365);
    }
    return acc;
}
export function YIELD(settlement, maturity, rate, pr, redemption, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) {
        return Number.NaN;
    }
    return undefined;
}
export function YIELDDISC(settlement, maturity, pr, redemption, frequency, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) {
        return Number.NaN;
    }
    return undefined;
}
export function YIELDMAT(settlement, maturity, issue, rate, pr, basis = 0) {
    if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis)) {
        return Number.NaN;
    }
    return undefined;
}
