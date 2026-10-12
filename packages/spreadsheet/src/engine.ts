import { FormulaError, ScalarType } from "@sheetxl/primitives";
import { formulaCount as publishedFormulaCount } from "@sheetxl/formulas";
import { functions } from "./vendor/sheetxl/registry.js";
import {
  Range,
  asRange,
  scalar,
  number,
  boolean,
  setFormulaContext,
  type Value,
  type Matrix,
} from "./range";
import {
  bindFormula,
  findCell,
  sheetKey,
  sheetCellURN,
  type Formula,
  type WorkbookSnapshot,
  type SheetSnapshot,
} from "./formula";
export type CalculatedCell = {
  value: string | number | boolean | null;
  error?: string;
  spill?: string;
};
export type Calculation = {
  values: Record<string, CalculatedCell>;
  functions: number;
  evaluated: number;
};
function hash(input: string) {
  let result = 2166136261;
  for (let at = 0; at < input.length; at++)
    result = Math.imul(result ^ input.charCodeAt(at), 16777619);
  return result >>> 0;
}
function error(label: string) {
  return new FormulaError.Known(12, label);
}
function asError(cause: unknown) {
  return cause instanceof FormulaError.Known
    ? cause
    : error(
        cause instanceof Error && cause.message.startsWith("#")
          ? cause.message
          : "#VALUE!",
      );
}
function matchCriterion(value: Value, criterion: Value) {
  const source = String(criterion ?? ""),
    match = /^(<=|>=|<>|=|<|>)(.*)$/.exec(source);
  if (match) {
    const right: Value =
      match[2] !== "" && Number.isFinite(Number(match[2]))
        ? Number(match[2])
        : match[2];
    const left =
        typeof right === "number"
          ? Number(value)
          : String(value ?? "").toLowerCase(),
      target = typeof right === "string" ? right.toLowerCase() : right;
    if (match[1] === "<>") return left !== target;
    if (match[1] === "=") return left === target;
    if (match[1] === "<") return left < target;
    if (match[1] === ">") return left > target;
    if (match[1] === "<=") return left <= target;
    return left >= target;
  }
  if (typeof criterion === "number") return value === criterion;
  const pattern = source
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/~([*?])/g, "\\$1")
    .replace(/(?<!\\)\*/g, ".*")
    .replace(/(?<!\\)\?/g, ".");
  return new RegExp(`^${pattern}$`, "i").test(String(value ?? ""));
}
const extras: Record<string, (args: any[]) => any> = {
  SUMIF: ([range, criterion, sumRange]) =>
    conditional("sum", sumRange ?? range, [range, criterion]),
  COUNTIF: ([range, criterion]) =>
    conditional("count", range, [range, criterion]),
  AVERAGEIF: ([range, criterion, sumRange]) =>
    conditional("average", sumRange ?? range, [range, criterion]),
  SUMIFS: ([range, ...conditions]) => conditional("sum", range, conditions),
  COUNTIFS: (conditions) => conditional("count", conditions[0], conditions),
  AVERAGEIFS: ([range, ...conditions]) =>
    conditional("average", range, conditions),
  FILTER: ([source, include, empty]) => {
    const data = asRange(source).data,
      tests = asRange(include).data;
    const rows = data.filter((_, index) => boolean(tests[index]?.[0] ?? false));
    return new Range(
      rows.length ? rows : [[empty ?? FormulaError.BuiltIn.Calc]],
    );
  },
  UNIQUE: ([source]) => {
    const seen = new Set<string>();
    return new Range(
      asRange(source).data.filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  },
  SORT: ([source, index = 1, order = 1]) =>
    new Range(
      [...asRange(source).data].sort(
        (a, b) =>
          (a[number(index) - 1] === b[number(index) - 1]
            ? 0
            : (a[number(index) - 1] ?? "") < (b[number(index) - 1] ?? "")
              ? -1
              : 1) * number(order),
      ),
    ),
  XLOOKUP: ([lookup, search, result, missing, mode = 0]) => {
    const values = asRange(search).flatten({ includeEmpty: true });
    const found = values.findIndex((value) =>
      number(mode) === 2
        ? matchCriterion(value, scalar(lookup))
        : String(value).toLowerCase() === String(scalar(lookup)).toLowerCase(),
    );
    if (found < 0) return missing ?? FormulaError.BuiltIn.NA;
    const output = asRange(result);
    return output.getHeight() === 1
      ? output.data[0][found]
      : new Range([output.data[found]]);
  },
};
function conditional(kind: string, source: any, conditions: any[]) {
  const values = asRange(source).flatten({ includeEmpty: true });
  const pairs: [Value[], Value][] = [];
  for (let index = 0; index < conditions.length; index += 2) {
    const range = asRange(conditions[index]).flatten({ includeEmpty: true });
    if (range.length !== values.length || conditions[index + 1] === undefined)
      throw FormulaError.BuiltIn.Value;
    pairs.push([range, scalar(conditions[index + 1])]);
  }
  const matched = values.filter((_, index) =>
    pairs.every(([range, criterion]) =>
      matchCriterion(range[index], criterion),
    ),
  );
  if (kind === "count") return matched.length;
  const numeric = matched.filter(
    (value) => typeof value === "number",
  ) as number[];
  const total = numeric.reduce((sum, value) => sum + value, 0);
  return kind === "sum"
    ? total
    : numeric.length
      ? total / numeric.length
      : FormulaError.BuiltIn.Div0;
}
export const formulaInfo = {
  implemented: Object.keys({ ...functions, ...extras }).length + 1,
  publishedFormulaCount,
  source: "SheetXL 0e96d8b + Office bindings",
  names: [
    ...new Set([...Object.keys(functions), ...Object.keys(extras), "REF"]),
  ].sort(),
};
const arrayFunctions = new Set([
  "SEQUENCE",
  "RANDARRAY",
  "FILTER",
  "SORT",
  "UNIQUE",
  "TRANSPOSE",
  "VSTACK",
  "HSTACK",
  "CHOOSECOLS",
  "CHOOSEROWS",
  "TAKE",
  "DROP",
  "EXPAND",
  "TOCOL",
  "TOROW",
]);
export class FormulaEngine {
  private snapshot: WorkbookSnapshot = { sheets: [], targets: {}, epoch: 0 };
  private memo = new Map<string, Value | Range>();
  private signatures = new Map<string, string>();
  private dependencies = new Map<string, Set<string>>();
  private dependents = new Map<string, Set<string>>();
  private stack = new Set<string>();
  private spills = new Map<string, { value: Value; origin: string }>();
  private arrays = new Map<string, string[]>();
  private evaluated = 0;
  private layout = "";
  private source = "";
  private stateHash = 0;
  private randomSlots = new Map<string, number>();
  calculate(snapshot: WorkbookSnapshot): Calculation {
    const layout = JSON.stringify([
      snapshot.sheets.map((sheet) => [
        sheetKey(sheet),
        sheet.name,
        sheet.rows,
        sheet.columns,
      ]),
      snapshot.targets,
      snapshot.epoch,
    ]);
    const signatures = new Map<string, string>();
    this.arrays.clear();
    for (const sheet of snapshot.sheets)
      for (const [id, cell] of Object.entries(sheet.cells)) {
        const urn = `${sheetKey(sheet)}:${id}`;
        signatures.set(urn, JSON.stringify(cell));
        if (
          cell.formula?.type === "array" ||
          (cell.formula?.type === "call" &&
            arrayFunctions.has(cell.formula.name))
        )
          this.arrays.set(sheetKey(sheet), [
            ...(this.arrays.get(sheetKey(sheet)) ?? []),
            urn,
          ]);
      }
    const content = JSON.stringify(
      [...signatures.entries()].sort(([a], [b]) => a.localeCompare(b)),
    );
    const nextHash = hash(content);
    if (nextHash !== this.stateHash)
      for (const [urn, signature] of signatures)
        if (/\b(?:RAND|RANDBETWEEN|RANDARRAY|NOW|TODAY)\s*\(/i.test(signature))
          this.invalidate(urn);
    this.stateHash = nextHash;
    if (layout !== this.layout || this.arrays.size) this.memo.clear();
    else
      for (const urn of new Set([
        ...signatures.keys(),
        ...this.signatures.keys(),
      ]))
        if (signatures.get(urn) !== this.signatures.get(urn))
          this.invalidate(urn);
    this.snapshot = snapshot;
    this.layout = layout;
    this.signatures = signatures;
    this.spills.clear();
    this.stack.clear();
    this.evaluated = 0;
    const values: Record<string, CalculatedCell> = {};
    for (const sheet of snapshot.sheets)
      for (const id of Object.keys(sheet.cells)) {
        const urn = `${sheetKey(sheet)}:${id}`;
        if (findCell(snapshot, urn)) values[urn] = this.output(this.read(urn));
      }
    for (const [urn, spill] of this.spills)
      values[urn] = { ...this.output(spill.value), spill: spill.origin };
    return {
      values,
      functions: formulaInfo.implemented,
      evaluated: this.evaluated,
    };
  }
  private invalidate(urn: string, seen = new Set<string>()) {
    if (seen.has(urn)) return;
    seen.add(urn);
    this.memo.delete(urn);
    for (const dependent of this.dependents.get(urn) ?? [])
      this.invalidate(dependent, seen);
  }
  private output(value: Value | Range): CalculatedCell {
    const result =
      value instanceof Range ? (value.data[0]?.[0] ?? null) : scalar(value);
    if (result instanceof FormulaError.Known)
      return { value: result.getLabel(), error: result.getLabel() };
    if (typeof result === "number" && !Number.isFinite(result))
      return { value: "#NUM!", error: "#NUM!" };
    return { value: result ?? null };
  }
  private track(urn: string) {
    if (!this.source || this.source === urn) return;
    const dependencies = this.dependencies.get(this.source) ?? new Set();
    dependencies.add(urn);
    this.dependencies.set(this.source, dependencies);
    const dependents = this.dependents.get(urn) ?? new Set();
    dependents.add(this.source);
    this.dependents.set(urn, dependents);
  }
  private read(urn: string): Value | Range {
    this.track(urn);
    if (this.stack.has(urn)) throw error("#CYCLE!");
    if (this.memo.has(urn)) {
      const cached = this.memo.get(urn)!;
      if (cached instanceof Range && cached.size > 1) this.spill(urn, cached);
      return cached;
    }
    const location = findCell(this.snapshot, urn);
    if (!location)
      return this.snapshot.targets[urn] ?? FormulaError.BuiltIn.Ref;
    const cell = location.sheet.cells[location.identifier];
    if (!cell?.input) {
      for (const anchor of this.arrays.get(sheetKey(location.sheet)) ?? [])
        if (!this.stack.has(anchor)) this.read(anchor);
      const spill = this.spills.get(urn);
      if (spill) {
        this.track(spill.origin);
        return spill.value;
      }
      return null;
    }
    this.stack.add(urn);
    if (this.stack.size > 512) {
      this.stack.delete(urn);
      return error("#LIMIT!");
    }
    const previousSource = this.source;
    this.source = urn;
    this.evaluated++;
    this.randomSlots.set(urn, 0);
    for (const dependency of this.dependencies.get(urn) ?? [])
      this.dependents.get(dependency)?.delete(urn);
    this.dependencies.delete(urn);
    let result: Value | Range;
    try {
      const formula =
        cell.formula ?? bindFormula(cell.input, location.sheet, this.snapshot);
      result = formula
        ? this.evaluate(formula, location.sheet)
        : cell.input.startsWith("'")
          ? cell.input.slice(1)
          : cell.input.trim() !== "" && Number.isFinite(Number(cell.input))
            ? Number(cell.input)
            : /^(TRUE|FALSE)$/i.test(cell.input)
              ? cell.input.toUpperCase() === "TRUE"
              : cell.input;
      if (result instanceof Range && result.size > 1) this.spill(urn, result);
    } catch (cause) {
      result = asError(cause);
    }
    this.source = previousSource;
    this.stack.delete(urn);
    this.memo.set(urn, result);
    return result;
  }
  private spill(origin: string, range: Range) {
    const location = findCell(this.snapshot, origin)!;
    if (
      range.size > 100000 ||
      location.row + range.getHeight() > location.sheet.rows.length ||
      location.column + range.getWidth() > location.sheet.columns.length
    )
      throw FormulaError.BuiltIn.Spill;
    const entries: [string, Value][] = [];
    range.data.forEach((row, r) =>
      row.forEach((value, c) => {
        const urn = sheetCellURN(
          location.sheet,
          location.column + c,
          location.row + r,
        );
        const target = findCell(this.snapshot, urn)!;
        if (
          urn !== origin &&
          (location.sheet.cells[target.identifier]?.input ||
            (this.spills.has(urn) && this.spills.get(urn)!.origin !== origin))
        )
          throw FormulaError.BuiltIn.Spill;
        entries.push([urn, value]);
      }),
    );
    for (const [urn, value] of entries) this.spills.set(urn, { value, origin });
  }
  private reference(urn: string): Range {
    const location = findCell(this.snapshot, urn);
    const value = scalar(this.read(urn));
    return new Range(
      [[value]],
      location
        ? {
            rowStart: location.row,
            rowEnd: location.row,
            colStart: location.column,
            colEnd: location.column,
          }
        : undefined,
    );
  }
  private evaluate(node: Formula, sheet: SheetSnapshot): any {
    if (node.type === "value") return node.value;
    if (node.type === "ref") return this.reference(node.urn);
    if (node.type === "range") {
      if (node.start.type !== "ref" || node.end.type !== "ref")
        throw FormulaError.BuiltIn.Ref;
      const start = findCell(this.snapshot, node.start.urn),
        end = findCell(this.snapshot, node.end.urn);
      if (!start || !end || sheetKey(start.sheet) !== sheetKey(end.sheet))
        throw FormulaError.BuiltIn.Ref;
      const rowStart = Math.min(start.row, end.row),
        rowEnd = Math.max(start.row, end.row),
        colStart = Math.min(start.column, end.column),
        colEnd = Math.max(start.column, end.column);
      if ((rowEnd - rowStart + 1) * (colEnd - colStart + 1) > 100000)
        throw error("#LIMIT!");
      return new Range(
        Array.from({ length: rowEnd - rowStart + 1 }, (_, r) =>
          Array.from({ length: colEnd - colStart + 1 }, (_, c) =>
            scalar(
              this.read(sheetCellURN(start.sheet, colStart + c, rowStart + r)),
            ),
          ),
        ),
        { rowStart, rowEnd, colStart, colEnd },
      );
    }
    if (node.type === "array")
      return new Range(
        node.rows.map((row) =>
          row.map((value) => scalar(this.evaluate(value, sheet))),
        ),
      );
    if (node.type === "unary") {
      const value = this.evaluate(node.value, sheet);
      if (node.operator === "#")
        return node.value.type === "ref" ? this.read(node.value.urn) : value;
      return asRange(value).map(
        (value) =>
          node.operator === "-"
            ? -number(value)
            : node.operator === "%"
              ? number(value) / 100
              : number(value),
        { includeEmpty: true },
      );
    }
    if (node.type === "binary") {
      const left = asRange(this.evaluate(node.left, sheet)),
        right = asRange(this.evaluate(node.right, sheet));
      return left.broadcast(
        right,
        (a, b) => {
          if (a instanceof FormulaError.Known) throw a;
          if (b instanceof FormulaError.Known) throw b;
          if (node.operator === "&") return `${a ?? ""}${b ?? ""}`;
          if (["=", "<>", "<", ">", "<=", ">="].includes(node.operator)) {
            const x = typeof a === "string" ? a.toLowerCase() : (a ?? 0),
              y = typeof b === "string" ? b.toLowerCase() : (b ?? 0);
            return node.operator === "="
              ? x === y
              : node.operator === "<>"
                ? x !== y
                : node.operator === "<"
                  ? x < y
                  : node.operator === ">"
                    ? x > y
                    : node.operator === "<="
                      ? x <= y
                      : x >= y;
          }
          const x = number(a),
            y = number(b);
          if (node.operator === "/" && y === 0) throw FormulaError.BuiltIn.Div0;
          return node.operator === "+"
            ? x + y
            : node.operator === "-"
              ? x - y
              : node.operator === "*"
                ? x * y
                : node.operator === "/"
                  ? x / y
                  : x ** y;
        },
        { mismatchFill: FormulaError.BuiltIn.NA },
      );
    }
    if (node.name === "IF") {
      const condition = this.evaluate(node.args[0], sheet);
      if (asRange(condition).size === 1)
        return this.evaluate(
          node.args[boolean(condition) ? 1 : 2] ?? {
            type: "value",
            value: false,
          },
          sheet,
        );
    }
    if (node.name === "IFERROR" || node.name === "IFNA") {
      try {
        const value = this.evaluate(node.args[0], sheet);
        const first = scalar(value);
        if (
          first instanceof FormulaError.Known &&
          (node.name === "IFERROR" || first.getLabel() === "#N/A")
        )
          return this.evaluate(node.args[1], sheet);
        return value;
      } catch (cause) {
        if (node.name === "IFNA" && asError(cause).getLabel() !== "#N/A")
          throw cause;
        return this.evaluate(node.args[1], sheet);
      }
    }
    if (["ISERROR", "ISERR", "ISNA", "ERROR.TYPE"].includes(node.name)) {
      let result: Value;
      try {
        result = scalar(this.evaluate(node.args[0], sheet));
      } catch (cause) {
        result = asError(cause);
      }
      if (node.name === "ERROR.TYPE")
        return result instanceof FormulaError.Known
          ? result.getCode()
          : FormulaError.BuiltIn.NA;
      return (
        result instanceof FormulaError.Known &&
        (node.name === "ISERROR" ||
          (node.name === "ISERR" && result.getLabel() !== "#N/A") ||
          (node.name === "ISNA" && result.getLabel() === "#N/A"))
      );
    }
    const args = node.args.map((argument) => this.evaluate(argument, sheet));
    const random = () => {
      const slot = this.randomSlots.get(this.source) ?? 0;
      this.randomSlots.set(this.source, slot + 1);
      return hash(`${this.stateHash}:${this.source}:${slot}`) / 4294967296;
    };
    if (node.name === "RAND") return random();
    if (node.name === "RANDBETWEEN") {
      const low = Math.ceil(number(args[0])),
        high = Math.floor(number(args[1]));
      if (high < low) throw FormulaError.BuiltIn.Num;
      return low + Math.floor(random() * (high - low + 1));
    }
    if (node.name === "RANDARRAY") {
      const rows = Math.floor(number(args[0] ?? 1)),
        columns = Math.floor(number(args[1] ?? 1)),
        low = number(args[2] ?? 0),
        high = number(args[3] ?? 1),
        whole = boolean(args[4] ?? false);
      if (rows <= 0 || columns <= 0 || rows * columns > 100000 || high < low)
        throw FormulaError.BuiltIn.Num;
      return new Range(
        Array.from({ length: rows }, () =>
          Array.from({ length: columns }, () =>
            whole
              ? Math.ceil(low) +
                Math.floor(random() * (Math.floor(high) - Math.ceil(low) + 1))
              : low + random() * (high - low),
          ),
        ),
      );
    }
    if (node.name === "REF") return this.reference(String(scalar(args[0])));
    if (extras[node.name]) return extras[node.name](args);
    const entry = functions[node.name];
    if (!entry) throw FormulaError.BuiltIn.Name;
    const location = findCell(this.snapshot, this.source)!;
    setFormulaContext({
      getRange: asRange,
      getPosition: () => ({
        rowIndex: location.row,
        colIndex: location.column,
      }),
      getEntireCoords: () => ({
        rowStart: 0,
        colStart: 0,
        rowEnd: sheet.rows.length - 1,
        colEnd: sheet.columns.length - 1,
      }),
      getValueAt: (row: number, column: number) =>
        scalar(this.read(sheetCellURN(sheet, column, row))),
      getFormulaAt: (row: number, column: number) =>
        sheet.cells[
          `${sheet.rows[row]}~${sheet.columns[column]}`
        ]?.input.startsWith("=")
          ? sheet.cells[`${sheet.rows[row]}~${sheet.columns[column]}`].input
          : null,
      getReference: (address: string) =>
        this.evaluate(bindFormula(`=${address}`, sheet, this.snapshot)!, sheet),
      getSheetCount: () =>
        this.snapshot.sheets.filter(
          (candidate) => candidate.document === sheet.document,
        ).length,
      getSheetIndex: (name: string) =>
        this.snapshot.sheets
          .filter((candidate) => candidate.document === sheet.document)
          .findIndex((candidate) => candidate.name === (name ?? sheet.name)),
      getAddress: (coords?: any) =>
        coords
          ? `${String.fromCharCode(65 + (coords.colStart ?? coords.colIndex))}${(coords.rowStart ?? coords.rowIndex) + 1}`
          : `${String.fromCharCode(65 + location.column)}${location.row + 1}`,
      toOADate: (date: Date) =>
        (Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          date.getHours(),
          date.getMinutes(),
          date.getSeconds(),
        ) -
          Date.UTC(1899, 11, 30)) /
        86400000,
      fromOADate: (serial: number) => {
        const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        return new Date(
          utc.getUTCFullYear(),
          utc.getUTCMonth(),
          utc.getUTCDate(),
          utc.getUTCHours(),
          utc.getUTCMinutes(),
          utc.getUTCSeconds(),
        );
      },
      parseAsDateTime: (text: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(text)
          ? (Date.parse(`${text}T00:00:00Z`) - Date.UTC(1899, 11, 30)) /
            86400000
          : null,
      getNumberFormat: (_format: string, value: Value) => String(value ?? ""),
      isValidDate: (value: any) =>
        value instanceof Date && Number.isFinite(value.getTime()),
      markVolatile: () => {},
      formatResults: () => {},
      getRuntime: () => ({
        getVersion: () => "Office",
        getOS: () => "browser",
        getUser: () => "",
        getLocation: () => "",
        getCurrency: () => "USD",
        getLocale: () => "en-US",
      }),
    });
    if (node.name === "NOW" || node.name === "TODAY") {
      const serial = (this.snapshot.epoch - Date.UTC(1899, 11, 30)) / 86400000;
      return node.name === "TODAY" ? Math.floor(serial) : serial;
    }
    const convert = (value: any, type: string): any => {
      if (type.includes("IRange") || type.includes("IReferenceRange")) {
        const range = asRange(value);
        const scalarType = /<(number|boolean|string)>/.exec(type)?.[1];
        if (!scalarType) return range;
        const converted = range.data.map((row) =>
          row.map((value) =>
            value instanceof FormulaError.Known
              ? value
              : scalarType === "number"
                ? typeof value === "number"
                  ? value
                  : range.isLiteral
                    ? number(value)
                    : null
                : scalarType === "boolean"
                  ? boolean(value)
                  : String(value ?? ""),
          ),
        );
        return new Range(converted, range.coords);
      }
      if (type.includes("[][]")) return asRange(value).data;
      if (type.includes("[]"))
        return asRange(value).flatten({ includeEmpty: true });
      if (type === "number") return number(value);
      if (type === "boolean") return boolean(value);
      if (type === "string") {
        const result = scalar(value);
        if (result instanceof FormulaError.Known) throw result;
        return String(result ?? "");
      }
      return scalar(value);
    };
    const parameters = entry.parameters;
    const converted: any[] = [];
    let at = 0;
    for (const parameter of parameters) {
      if (parameter.rest) {
        while (at < args.length)
          converted.push(
            convert(args[at++], parameter.type.replace(/\[\]$/, "")),
          );
      } else {
        if (at >= args.length && !parameter.optional)
          throw FormulaError.BuiltIn.Value;
        converted.push(
          at >= args.length || (args[at] === null && parameter.optional)
            ? undefined
            : convert(args[at], parameter.type),
        );
        at++;
      }
    }
    const result = entry.fn(...converted);
    if (result === undefined || result instanceof Promise)
      throw FormulaError.BuiltIn.Name;
    return Array.isArray(result) ? asRange(result) : result;
  }
}
