// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.
import { FormulaError, ScalarType, FormulaContext } from '@sheetxl/primitives';
const Factorials = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600, 6227020800, 87178291200, 1307674368000, 20922789888000, 355687428096000, 6402373705728000, 121645100408832000, 2432902008176640000, 51090942171709440000, 1124000727777607680000, 25852016738884976640000, 620448401733239439360000, 15511210043330985984000000, 403291461126605635584000000, 10888869450418352160768000000, 304888344611713860501504000000, 8841761993739701954543616000000, 265252859812191058636308480000000, 8222838654177922817725562880000000, 263130836933693530167218012160000000, 8683317618811886495518194401280000000, 295232799039604140847618609643520000000, 10333147966386144929666651337523200000000, 371993326789901217467999448150835200000000, 13763753091226345046315979581580902400000000, 523022617466601111760007224100074291200000000, 20397882081197443358640281739902897356800000000, 815915283247897734345611269596115894272000000000, 33452526613163807108170062053440751665152000000000, 1405006117752879898543142606244511569936384000000000, 60415263063373835637355132068513997507264512000000000, 2658271574788448768043625811014615890319638528000000000, 119622220865480194561963161495657715064383733760000000000, 5502622159812088949850305428800254892961651752960000000000, 258623241511168180642964355153611979969197632389120000000000, 12413915592536072670862289047373375038521486354677760000000000, 608281864034267560872252163321295376887552831379210240000000000, 30414093201713378043612608166064768844377641568960512000000000000, 1551118753287382280224243016469303211063259720016986112000000000000, 80658175170943878571660636856403766975289505440883277824000000000000, 4274883284060025564298013753389399649690343788366813724672000000000000, 230843697339241380472092742683027581083278564571807941132288000000000000, 12696403353658275925965100847566516959580321051449436762275840000000000000, 710998587804863451854045647463724949736497978881168458687447040000000000000, 40526919504877216755680601905432322134980384796226602145184481280000000000000, 2350561331282878571829474910515074683828862318181142924420699914240000000000000, 138683118545689835737939019720389406345902876772687432540821294940160000000000000, 8320987112741390144276341183223364380754172606361245952449277696409600000000000000, 507580213877224798800856812176625227226004528988036003099405939480985600000000000000, 31469973260387937525653122354950764088012280797258232192163168247821107200000000000000, 1982608315404440064116146708361898137544773690227268628106279599612729753600000000000000, 126886932185884164103433389335161480802865516174545192198801894375214704230400000000000000, 8247650592082470666723170306785496252186258551345437492922123134388955774976000000000000000, 544344939077443064003729240247842752644293064388798874532860126869671081148416000000000000000, 36471110918188685288249859096605464427167635314049524593701628500267962436943872000000000000000, 2480035542436830599600990418569171581047399201355367672371710738018221445712183296000000000000000, 171122452428141311372468338881272839092270544893520369393648040923257279754140647424000000000000000, 11978571669969891796072783721689098736458938142546425857555362864628009582789845319680000000000000000, 850478588567862317521167644239926010288584608120796235886430763388588680378079017697280000000000000000, 61234458376886086861524070385274672740778091784697328983823014963978384987221689274204160000000000000000, 4470115461512684340891257138125051110076800700282905015819080092370422104067183317016903680000000000000000, 330788544151938641225953028221253782145683251820934971170611926835411235700971565459250872320000000000000000, 24809140811395398091946477116594033660926243886570122837795894512655842677572867409443815424000000000000000000, 1885494701666050254987932260861146558230394535379329335672487982961844043495537923117729972224000000000000000000, 145183092028285869634070784086308284983740379224208358846781574688061991349156420080065207861248000000000000000000, 11324281178206297831457521158732046228731749579488251990048962825668835325234200766245086213177344000000000000000000, 894618213078297528685144171539831652069808216779571907213868063227837990693501860533361810841010176000000000000000000, 71569457046263802294811533723186532165584657342365752577109445058227039255480148842668944867280814080000000000000000000, 5797126020747367985879734231578109105412357244731625958745865049716390179693892056256184534249745940480000000000000000000, 475364333701284174842138206989404946643813294067993328617160934076743994734899148613007131808479167119360000000000000000000, 39455239697206586511897471180120610571436503407643446275224357528369751562996629334879591940103770870906880000000000000000000, 3314240134565353266999387579130131288000666286242049487118846032383059131291716864129885722968716753156177920000000000000000000, 281710411438055027694947944226061159480056634330574206405101912752560026159795933451040286452340924018275123200000000000000000000, 24227095383672732381765523203441259715284870552429381750838764496720162249742450276789464634901319465571660595200000000000000000000, 2107757298379527717213600518699389595229783738061356212322972511214654115727593174080683423236414793504734471782400000000000000000000, 185482642257398439114796845645546284380220968949399346684421580986889562184028199319100141244804501828416633516851200000000000000000000, 16507955160908461081216919262453619309839666236496541854913520707833171034378509739399912570787600662729080382999756800000000000000000000, 1485715964481761497309522733620825737885569961284688766942216863704985393094065876545992131370884059645617234469978112000000000000000000000, 135200152767840296255166568759495142147586866476906677791741734597153670771559994765685283954750449427751168336768008192000000000000000000000, 12438414054641307255475324325873553077577991715875414356840239582938137710983519518443046123837041347353107486982656753664000000000000000000000, 1156772507081641574759205162306240436214753229576413535186142281213246807121467315215203289516844845303838996289387078090752000000000000000000000, 108736615665674308027365285256786601004186803580182872307497374434045199869417927630229109214583415458560865651202385340530688000000000000000000000, 10329978488239059262599702099394727095397746340117372869212250571234293987594703124871765375385424468563282236864226607350415360000000000000000000000, 991677934870949689209571401541893801158183648651267795444376054838492222809091499987689476037000748982075094738965754305639874560000000000000000000000, 96192759682482119853328425949563698712343813919172976158104477319333745612481875498805879175589072651261284189679678167647067832320000000000000000000000, 9426890448883247745626185743057242473809693764078951663494238777294707070023223798882976159207729119823605850588608460429412647567360000000000000000000000, 933262154439441526816992388562667004907159682643816214685929638952175999932299156089414639761565182862536979208272237582511852109168640000000000000000000000, 93326215443944152681699238856266700490715968264381621468592963895217599993229915608941463976156518286253697920827223758251185210916864000000000000000000000000];
const f = [];
const fd = [];
function snapZero(x) {
    return Math.abs(x) < 9.9e-13 ? 0 : x;
}
function factorial(n) {
    if (n <= 100)
        return Factorials[n];
    if (f[n] > 0)
        return f[n];
    return f[n] = factorial(n - 1) * n;
}
function factorialDouble(n) {
    if (n === 1 || n === 0)
        return 1;
    if (n === 2)
        return 2;
    if (fd[n] > 0)
        return fd[n];
    return fd[n] = factorialDouble(n - 2) * n;
}
function flatten2D(array2D) {
    const retValue = [];
    const array2DLength = array2D.length;
    for (let i = 0; i < array2DLength; i++) {
        const row = array2D[i];
        const rowLength = row.length;
        for (let j = 0; j < rowLength; j++) {
            retValue.push(row[j]);
        }
    }
    return retValue;
}
const sumArrays = (arrayX, arrayY, callbackFn) => {
    const x = flatten2D(arrayX);
    const y = flatten2D(arrayY);
    let sum = 0;
    if (x.length !== y.length) {
        throw FormulaError.BuiltIn.NA;
    }
    const xLength = x.length;
    for (let i = 0; i < xLength; i++) {
        if (typeof x[i] === "number" && typeof y[i] === "number") {
            sum = snapZero(sum + callbackFn(x[i], y[i]));
        }
    }
    return sum;
};
export function ABS(number) {
    return Math.abs(number);
}
export function AGGREGATE(functionNum, options, array, K) {
    return undefined;
}
export function ARABIC(text) {
    if (!/^M*(?:D?C{0,3}|C[MD])(?:L?X{0,3}|X[CL])(?:V?I{0,3}|I[XV])$/.test(text)) {
        throw new FormulaError.Value('Invalid roman numeral in ARABIC evaluation.');
    }
    let r = 0;
    text.replace(/[MDLV]|C[MD]?|X[CL]?|I[XV]?/g, (i) => {
        r += {
            M: 1000,
            CM: 900,
            D: 500,
            CD: 400,
            C: 100,
            XC: 90,
            L: 50,
            XL: 40,
            X: 10,
            IX: 9,
            V: 5,
            IV: 4,
            I: 1
        }[i];
    });
    return r;
}
export function BASE(number, radix, minLength = 0) {
    if (number < 0 || number >= 2 ** 53)
        return Number.NaN;
    if (radix < 2 || radix > 36)
        return Number.NaN;
    if (minLength < 0)
        return Number.NaN;
    const result = number.toString(radix).toUpperCase();
    return new Array(Math.max(minLength + 1 - result.length, 0)).join('0') + result;
}
export function CEILING(number, significance = undefined) {
    if (significance === 0)
        return 0;
    if (number / significance % 1 === 0)
        return number;
    const absSignificance = Math.abs(significance);
    const times = Math.floor(Math.abs(number) / absSignificance);
    if (number < 0) {
        const roundDown = significance < 0;
        return roundDown ? -absSignificance * (times + 1) : -absSignificance * (times);
    }
    else {
        return (times + 1) * absSignificance;
    }
}
export function CEILING_MATH(number, significance = undefined, mode = 0) {
    significance = significance ?? (number > 0 ? 1 : -1);
    if (significance === 0)
        return 0;
    if (number >= 0) {
        return CEILING(number, significance);
    }
    const offset = mode ? significance : 0;
    return CEILING(number, significance) - offset;
}
export function CEILING_PRECISE(number, significance = 1) {
    if (significance === 0)
        return 0;
    return CEILING(number, Math.abs(significance));
}
;
export function COMBIN(number, numberChosen) {
    if (number < 0 || numberChosen < 0 || number < numberChosen)
        return Number.NaN;
    const nFactorial = FACT(number);
    const kFactorial = FACT(numberChosen);
    return nFactorial / kFactorial / FACT(number - numberChosen);
}
;
export function COMBINA(number, numberChosen) {
    if ((number === 0 || number === 1) && numberChosen === 0)
        return 1;
    if (number < 0 || numberChosen < 0)
        return Number.NaN;
    return COMBIN(number + numberChosen - 1, number - 1);
}
;
export function DECIMAL(number, radix) {
    radix = Math.trunc(radix);
    if (radix < 2 || radix > 36)
        return Number.NaN;
    return parseInt(number, radix);
}
;
export function DEGREES(angle) {
    return angle * (180 / Math.PI);
}
;
export function EVEN(number) {
    return CEILING(number, -2);
}
;
export function EXP(number) {
    return Math.exp(number);
}
;
export function FACT(number) {
    number = Math.trunc(number);
    if (number > 170 || number < 0)
        return Number.NaN;
    if (number <= 100)
        return Factorials[number];
    return factorial(number);
}
;
export function FACTDOUBLE(number) {
    number = Math.trunc(number);
    if (number < -1)
        return Number.NaN;
    if (number === -1)
        return 1;
    return factorialDouble(number);
}
;
export function FLOOR(number, significance = undefined) {
    if (number === 0)
        return 0;
    if (significance === 0)
        return Infinity;
    significance = significance ?? (number > 0 ? 1 : -1);
    if (number > 0 && significance < 0)
        return Number.NaN;
    if (number / significance % 1 === 0)
        return number;
    const absSignificance = Math.abs(significance);
    const times = Math.floor(Math.abs(number) / absSignificance);
    if (number < 0) {
        const roundDown = significance < 0;
        return roundDown ? -absSignificance * times : -absSignificance * (times + 1);
    }
    else {
        return times * absSignificance;
    }
}
;
export function FLOOR_MATH(number, significance = undefined, mode = 0) {
    significance = significance ?? (number > 0 ? 1 : -1);
    if (significance === 0)
        return 0;
    if (mode === 0 || number >= 0) {
        return FLOOR(number, Math.abs(significance));
    }
    return FLOOR(number, significance) + significance;
}
;
export function FLOOR_PRECISE(number, significance = 1) {
    if (significance === 0)
        return 0;
    return FLOOR(number, Math.abs(significance));
}
;
export function GCD(...number) {
    let x = number[0];
    if (x < 0 || x > 9007199254740990)
        return Number.NaN;
    x = Math.abs(Math.abs(Math.trunc(x)));
    let y;
    const l = number.length;
    for (let i = 1; i < l; i++) {
        y = number[i];
        if (y < 0 || y > 9007199254740990)
            return Number.NaN;
        y = Math.abs(Math.trunc(y));
        while (x && y) {
            (x > y) ? x %= y : y %= x;
        }
        x += y;
    }
    return x;
}
;
export function INT(number) {
    return Math.floor(number);
}
;
export function ISO_CEILING(number, significance = undefined) {
    return CEILING_PRECISE(number, significance);
}
;
export function LCM(...number) {
    let x = number[0];
    if (x < 0 || x > 9007199254740990)
        return Number.NaN;
    x = Math.abs(Math.trunc(x));
    let y;
    let z;
    const l = number.length;
    for (let i = 1; i < l; i++) {
        const n = number[i];
        if (n < 0 || n > 9007199254740990)
            return Number.NaN;
        y = Math.abs(Math.trunc(n));
        z = x;
        while (x && y) {
            x > y ? x %= y : y %= x;
        }
        x = Math.abs(z * n) / (x + y);
    }
    return x;
}
;
export function LN(number) {
    return Math.log(number);
}
;
export function LOG(number, base = 10) {
    return Math.log(number) / Math.log(base);
}
;
export function LOG10(number) {
    return Math.log10(number);
}
;
export function MDETERM(array) {
    if (array[0].length !== array.length)
        throw FormulaError.BuiltIn.Value;
    const numRow = array.length, numCol = array[0].length;
    let det = 0;
    let diagLeft;
    let diagRight;
    if (numRow === 1) {
        return array[0][0];
    }
    else if (numRow === 2) {
        return array[0][0] * array[1][1] - array[0][1] * array[1][0];
    }
    for (let col = 0; col < numCol; col++) {
        diagLeft = array[0][col];
        diagRight = array[0][col];
        for (let row = 1; row < numRow; row++) {
            diagRight *= array[row][(((col + row) % numCol) + numCol) % numCol];
            diagLeft *= array[row][(((col - row) % numCol) + numCol) % numCol];
        }
        det += diagRight - diagLeft;
    }
    return det;
}
;
export function MINVERSE(array) {
}
;
export function MMULT(array1, array2) {
    const aNumRows = array1.length;
    const aNumCols = array1[0].length;
    const bNumRows = array2.length;
    const bNumCols = array2[0].length;
    if (aNumCols !== bNumRows)
        throw FormulaError.BuiltIn.Value;
    const m = new Array(aNumRows);
    for (let r = 0; r < aNumRows; r++) {
        m[r] = new Array(bNumCols);
        for (let c = 0; c < bNumCols; c++) {
            m[r][c] = 0;
            for (let i = 0; i < aNumCols; i++) {
                const v1 = array1[r][i];
                const v2 = array2[i][c];
                if (typeof v1 !== "number" || typeof v2 !== "number")
                    throw FormulaError.BuiltIn.Value;
                m[r][c] += array1[r][i] * array2[i][c];
            }
        }
    }
    return m;
}
;
export function MOD(number, divisor) {
    if (divisor === 0)
        return Infinity;
    return number - divisor * INT(number / divisor);
}
;
export function MROUND(number, multiple) {
    if (multiple === 0)
        return 0;
    if (number > 0 && multiple < 0 || number < 0 && multiple > 0)
        return Number.NaN;
    if (number / multiple % 1 === 0)
        return number;
    return Math.round(number / multiple) * multiple;
}
;
export function MULTINOMIAL(...number) {
    let numerator = 0;
    let denominator = 1;
    const numberLength = number.length;
    for (let i = 0; i < numberLength; i++) {
        const num = number[i];
        if (num < 0)
            return Number.NaN;
        numerator += num;
        denominator *= factorial(num);
    }
    return factorial(numerator) / denominator;
}
;
export function MUNIT(dimension) {
    const matrix = [];
    for (let row = 0; row < dimension; row++) {
        const rowArr = [];
        for (let col = 0; col < dimension; col++) {
            if (row === col)
                rowArr.push(1);
            else
                rowArr.push(0);
        }
        matrix.push(rowArr);
    }
    return matrix;
}
;
export function ODD(number) {
    if (number === 0)
        return 1;
    let temp = Math.ceil(Math.abs(number));
    temp = (temp & 1) ? temp : temp + 1;
    return (number > 0) ? temp : -temp;
}
;
export function PI() {
    return Math.PI;
}
;
export function POWER(number, power) {
    return number ** power;
}
;
export function PRODUCT(...number) {
    let product = 1;
    for (const range of number) {
        for (const value of range.values()) {
            product *= value;
        }
    }
    return product;
}
export function QUOTIENT(numerator, denominator) {
    return Math.trunc(numerator / denominator);
}
;
export function RADIANS(angle) {
    return angle / 180 * Math.PI;
}
;
export function RAND() {
    FormulaContext.markVolatile();
    return Math.random();
}
;
export function RANDARRAY(rows = 1, columns = 1, min = 0, max = 1, integer = false) {
    if (rows === 0 || columns === 0)
        throw FormulaError.BuiltIn.Calc;
    if (rows < 0 || columns < 0)
        throw FormulaError.BuiltIn.Value;
    const entireCoords = FormulaContext.getEntireCoords();
    if (rows + 1 > entireCoords.rowEnd || columns + 1 > entireCoords.colEnd)
        throw FormulaError.BuiltIn.Value;
    if (min > max)
        throw Number.NaN;
    const rowsInt = Math.floor(rows);
    const columnsInt = Math.floor(columns);
    const result = new Array(rowsInt);
    for (let r = 0; r < rowsInt; r++) {
        const row = new Array(columnsInt);
        for (let c = 0; c < columnsInt; c++) {
            let randomValue = min + Math.random() * (max - min);
            if (integer) {
                randomValue = Math.floor(randomValue);
                if (randomValue > max)
                    randomValue = max;
            }
            row[c] = randomValue;
        }
        result[r] = row;
    }
    FormulaContext.markVolatile();
    return result;
}
;
export function RANDBETWEEN(bottom, top) {
    FormulaContext.markVolatile();
    return Math.floor(Math.random() * (top - bottom + 1) + bottom);
}
;
export function ROMAN(number, form = 0) {
    if (form !== 0)
        throw Error('ROMAN: only allows form=0 (classic form).');
    const digits = String(number).split('');
    const key = ['', 'C', 'CC', 'CCC', 'CD', 'D', 'DC', 'DCC', 'DCCC', 'CM', '', 'X', 'XX', 'XXX', 'XL', 'L', 'LX', 'LXX', 'LXXX', 'XC', '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
    let roman = '';
    let i = 3;
    while (i--) {
        roman = (key[+digits.pop() + (i * 10)] || '') + roman;
    }
    return new Array(+digits.join('') + 1).join('M') + roman;
}
;
export function ROUND(number, numDigits) {
    const multiplier = Math.pow(10, Math.abs(numDigits));
    const sign = number > 0 ? 1 : -1;
    if (numDigits > 0) {
        return sign * Math.round(Math.abs(number) * multiplier) / multiplier;
    }
    else if (numDigits === 0) {
        return sign * Math.round(Math.abs(number));
    }
    else {
        return sign * Math.round(Math.abs(number) / multiplier) * multiplier;
    }
}
;
export function ROUNDDOWN(number, numDigits) {
    const multiplier = Math.pow(10, Math.abs(numDigits));
    const sign = number > 0 ? 1 : -1;
    if (numDigits > 0) {
        const offset = 1 / multiplier * 0.5;
        return sign * Math.round((Math.abs(number) - offset) * multiplier) / multiplier;
    }
    else if (numDigits === 0) {
        const offset = 0.5;
        return sign * Math.round((Math.abs(number) - offset));
    }
    else {
        const offset = multiplier * 0.5;
        return sign * Math.round((Math.abs(number) - offset) / multiplier) * multiplier;
    }
}
;
export function ROUNDUP(number, numDigits) {
    const multiplier = Math.pow(10, Math.abs(numDigits));
    const sign = number > 0 ? 1 : -1;
    if (numDigits > 0) {
        const offset = 1 / multiplier * 0.5;
        return sign * Math.round((Math.abs(number) + offset) * multiplier) / multiplier;
    }
    else if (numDigits === 0) {
        const offset = 0.5;
        return sign * Math.round((Math.abs(number) + offset));
    }
    else {
        const offset = multiplier * 0.5;
        return sign * Math.round((Math.abs(number) + offset) / multiplier) * multiplier;
    }
}
;
export function SEQUENCE(rows, columns = 1, start = 1, step = 1) {
    if (rows === 0 || columns === 0)
        throw FormulaError.BuiltIn.Calc;
    if (rows < 0 || columns < 0)
        throw FormulaError.BuiltIn.Value;
    const entireCoords = FormulaContext.getEntireCoords();
    if (rows + 1 > entireCoords.rowEnd || columns + 1 > entireCoords.colEnd)
        throw FormulaError.BuiltIn.Value;
    const rowsInt = Math.floor(rows);
    const columnsInt = Math.floor(columns);
    let currentValue = start;
    const result = new Array(rowsInt);
    for (let r = 0; r < rowsInt; r++) {
        const row = new Array(columnsInt);
        for (let c = 0; c < columnsInt; c++) {
            row[c] = currentValue;
            currentValue += step;
        }
        result[r] = row;
    }
    return result;
}
export function SERIESSUM(x, n, m, ...coefficients) {
    let result;
    const coefficientsLength = coefficients.length;
    for (let i = 0; i < coefficientsLength; i++) {
        const coefficient = coefficients[i];
        if (typeof coefficient !== "number") {
            throw FormulaError.BuiltIn.Value;
        }
        if (i === 0) {
            result = coefficient * Math.pow(x, n);
        }
        else {
            result += coefficient * Math.pow(x, n + i * m);
        }
    }
    return result;
}
;
export function SIGN(number) {
    return number > 0 ? 1 : number === 0 ? 0 : -1;
}
;
export function SQRT(number) {
    return Math.sqrt(number);
}
;
export function SQRTPI(number) {
    if (number < 0)
        return Number.NaN;
    return Math.sqrt(number * Math.PI);
}
;
export function SUBTOTAL(functionNum, ...ref) {
}
;
export function SUM(...number) {
    let sum = 0;
    for (const range of number) {
        for (const value of range.values()) {
            sum = snapZero(sum + value);
        }
    }
    return sum;
}
export function SUMIF(range, criteria, sumRange) {
    return undefined;
}
;
export function SUMIFS(sumRange, criteriaRange, criteria) {
    return undefined;
}
;
export function SUMPRODUCT(array1, ...rest) {
    rest.forEach(array => {
        if (array1[0].length !== array[0].length || array1.length !== array.length) {
            throw FormulaError.BuiltIn.Value;
        }
        const array1Length = array1.length;
        for (let i = 0; i < array1Length; i++) {
            for (let j = 0; j < array1[0].length; j++) {
                if (typeof array1[i][j] !== "number")
                    array1[i][j] = 0;
                if (typeof array[i][j] !== "number")
                    array[i][j] = 0;
                array1[i][j] *= array[i][j];
            }
        }
    });
    let sum = 0;
    array1.forEach(row => {
        row.forEach(value => {
            sum = snapZero(sum + value);
        });
    });
    return sum;
}
;
export function SUMSQ(...number) {
    let sum = 0;
    for (const range of number) {
        for (const value of range.values({ type: ScalarType.Number, includeBoolean: true })) {
            sum = snapZero(sum + (value ** 2));
        }
    }
    return sum;
}
export function SUMX2MY2(arrayX, arrayY) {
    return sumArrays(arrayX, arrayY, (x, y) => x ** 2 - y ** 2);
}
;
export function SUMX2PY2(arrayX, arrayY) {
    return sumArrays(arrayX, arrayY, (x, y) => x ** 2 + y ** 2);
}
;
export function SUMXMY2(arrayX, arrayY) {
    return sumArrays(arrayX, arrayY, (x, y) => (x - y) ** 2);
}
;
export function TRUNC(number, numDigits = 0) {
    return Math.trunc(number);
}
;
